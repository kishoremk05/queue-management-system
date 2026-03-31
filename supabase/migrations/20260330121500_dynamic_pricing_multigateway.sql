-- Dynamic pricing, multi-gateway support, and commission tracking

create table if not exists public.billing_plans (
  id text primary key,
  name text not null,
  description text not null,
  amount integer not null,
  currency text not null default 'NGN',
  period_label text not null default '/month',
  features jsonb not null default '[]'::jsonb,
  cta text not null default 'Choose Plan',
  highlighted boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_plans_amount_check check (amount >= 0)
);

insert into public.billing_plans (
  id, name, description, amount, currency, period_label, features, cta, highlighted, is_active, sort_order
)
values
  (
    'starter',
    'Starter',
    'Perfect for small businesses with a single location.',
    5000,
    'USD',
    '/month',
    '["1 service counter","Up to 3 services","Basic queue display","Token generation","Email support"]'::jsonb,
    'Choose Starter',
    false,
    true,
    1
  ),
  (
    'professional',
    'Professional',
    'For growing businesses needing advanced queue management.',
    10000,
    'USD',
    '/month',
    '["Unlimited counters","Unlimited services","Priority queuing (VIP/Urgent)","Audio announcements","Analytics & reports","Thermal ticket printing","Staff management","Priority support"]'::jsonb,
    'Choose Professional',
    true,
    true,
    2
  ),
  (
    'enterprise',
    'Enterprise',
    'Multi-branch operations with full feature access.',
    15000,
    'USD',
    '/month',
    '["Everything in Professional","Multi-branch support","Advanced queue alerts","Custom branding","API access","Dedicated account manager","SLA guarantee"]'::jsonb,
    'Choose Enterprise',
    false,
    true,
    3
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  amount = excluded.amount,
  currency = excluded.currency,
  period_label = excluded.period_label,
  features = excluded.features,
  cta = excluded.cta,
  highlighted = excluded.highlighted,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.platform_payment_settings (
  id integer primary key default 1,
  default_provider text not null default 'paystack',
  commission_type text not null default 'percentage',
  commission_value numeric(8,4) not null default 2.5000,
  commission_flat_amount integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_payment_settings_singleton check (id = 1),
  constraint platform_payment_settings_provider_check check (default_provider in ('paystack', 'flutterwave')),
  constraint platform_payment_settings_commission_type_check check (commission_type in ('percentage', 'flat')),
  constraint platform_payment_settings_commission_value_check check (commission_value >= 0),
  constraint platform_payment_settings_commission_flat_amount_check check (commission_flat_amount >= 0)
);

insert into public.platform_payment_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.company_requests
add column if not exists payment_provider text not null default 'paystack',
add column if not exists payment_reference text;

alter table public.company_requests
drop constraint if exists company_requests_payment_provider_check;

alter table public.company_requests
add constraint company_requests_payment_provider_check check (
  payment_provider in ('paystack', 'flutterwave')
);

create unique index if not exists company_requests_payment_reference_key
  on public.company_requests(payment_reference)
  where payment_reference is not null;

alter table public.payment_transactions
add column if not exists provider text not null default 'paystack',
add column if not exists payment_reference text,
add column if not exists gross_amount integer not null default 0,
add column if not exists commission_amount integer not null default 0,
add column if not exists net_amount integer not null default 0,
add column if not exists gateway_fee integer not null default 0;

update public.payment_transactions
set
  payment_reference = coalesce(payment_reference, paystack_reference),
  gross_amount = case when gross_amount = 0 then amount else gross_amount end,
  net_amount = case when net_amount = 0 then amount else net_amount end
where true;

alter table public.payment_transactions
drop constraint if exists payment_transactions_provider_check;

alter table public.payment_transactions
add constraint payment_transactions_provider_check check (
  provider in ('paystack', 'flutterwave')
);

create unique index if not exists payment_transactions_payment_reference_key
  on public.payment_transactions(payment_reference)
  where payment_reference is not null;

alter table public.organization_subscriptions
add column if not exists payment_provider text not null default 'paystack',
add column if not exists payment_reference text;

alter table public.organization_subscriptions
drop constraint if exists organization_subscriptions_payment_provider_check;

alter table public.organization_subscriptions
add constraint organization_subscriptions_payment_provider_check check (
  payment_provider in ('paystack', 'flutterwave')
);

alter table public.billing_plans enable row level security;
alter table public.platform_payment_settings enable row level security;

create policy "Anyone can view active billing plans" on public.billing_plans
for select to anon, authenticated
using (is_active = true or public.has_role(auth.uid(), 'super_admin'));

create policy "Super admins can manage billing plans" on public.billing_plans
for all to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Authenticated can view payment settings" on public.platform_payment_settings
for select to authenticated
using (true);

create policy "Super admins can manage payment settings" on public.platform_payment_settings
for all to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));
