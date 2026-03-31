-- Multi-currency pricing controlled in Supabase by super admins

-- Ensure base billing_plans table exists when this migration is executed standalone
create table if not exists public.billing_plans (
  id text primary key,
  name text not null,
  description text not null,
  amount integer not null,
  currency text not null default 'USD',
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

create table if not exists public.billing_plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.billing_plans(id) on delete cascade,
  currency text not null,
  amount integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_plan_prices_currency_check check (char_length(currency) = 3),
  constraint billing_plan_prices_amount_check check (amount >= 0),
  unique (plan_id, currency)
);

-- Seed multi-currency rows (minor units)
insert into public.billing_plan_prices (plan_id, currency, amount, is_active)
values
  ('starter', 'NGN', 7500000, true),
  ('starter', 'USD', 5000, true),
  ('starter', 'EUR', 1800, true),
  ('starter', 'GBP', 1600, true),
  ('starter', 'KES', 250000, true),
  ('starter', 'ZAR', 36000, true),
  ('starter', 'GHS', 26000, true),

  ('professional', 'NGN', 15000000, true),
  ('professional', 'USD', 10000, true),
  ('professional', 'EUR', 4500, true),
  ('professional', 'GBP', 4000, true),
  ('professional', 'KES', 650000, true),
  ('professional', 'ZAR', 92000, true),
  ('professional', 'GHS', 71000, true),

  ('enterprise', 'NGN', 22500000, true),
  ('enterprise', 'USD', 15000, true),
  ('enterprise', 'EUR', 10900, true),
  ('enterprise', 'GBP', 9800, true),
  ('enterprise', 'KES', 1550000, true),
  ('enterprise', 'ZAR', 230000, true),
  ('enterprise', 'GHS', 185000, true)
on conflict (plan_id, currency) do update
set amount = excluded.amount,
    is_active = excluded.is_active,
    updated_at = now();

alter table public.company_requests
add column if not exists selected_currency text not null default 'USD';

alter table public.company_requests
drop constraint if exists company_requests_selected_currency_check;

alter table public.company_requests
add constraint company_requests_selected_currency_check check (char_length(selected_currency) = 3);

alter table public.billing_plan_prices enable row level security;

create policy "Anyone can view active plan prices" on public.billing_plan_prices
for select to anon, authenticated
using (is_active = true or public.has_role(auth.uid(), 'super_admin'));

create policy "Super admins can manage plan prices" on public.billing_plan_prices
for all to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));
