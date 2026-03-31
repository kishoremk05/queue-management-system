-- Track billing and Paystack payment lifecycle for company onboarding
alter table public.company_requests
add column if not exists selected_plan text not null default 'professional',
add column if not exists paystack_reference text,
add column if not exists payment_status text not null default 'unpaid',
add column if not exists payment_amount integer not null default 0,
add column if not exists payment_currency text not null default 'NGN',
add column if not exists paid_at timestamptz,
add column if not exists payment_metadata jsonb not null default '{}'::jsonb;

alter table public.company_requests
drop constraint if exists company_requests_selected_plan_check;

alter table public.company_requests
add constraint company_requests_selected_plan_check check (
  selected_plan in ('starter', 'professional', 'enterprise')
);

alter table public.company_requests
drop constraint if exists company_requests_payment_status_check;

alter table public.company_requests
add constraint company_requests_payment_status_check check (
  payment_status in ('unpaid', 'initialized', 'paid', 'failed', 'abandoned')
);

create unique index if not exists company_requests_paystack_reference_key
  on public.company_requests(paystack_reference)
  where paystack_reference is not null;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.company_requests(id) on delete cascade,
  paystack_reference text not null unique,
  plan_id text not null,
  amount integer not null,
  currency text not null,
  status text not null,
  gateway_message text,
  paid_at timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_transactions_plan_id_check check (
    plan_id in ('starter', 'professional', 'enterprise')
  )
);

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  request_id uuid references public.company_requests(id) on delete set null,
  plan_id text not null,
  status text not null default 'active',
  amount integer not null,
  currency text not null,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  next_billing_at timestamptz,
  paystack_reference text,
  paystack_customer_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_plan_id_check check (
    plan_id in ('starter', 'professional', 'enterprise')
  ),
  constraint organization_subscriptions_status_check check (
    status in ('active', 'past_due', 'canceled', 'trialing')
  )
);

alter table public.payment_transactions enable row level security;
alter table public.organization_subscriptions enable row level security;

create policy "Company request owner can view payments" on public.payment_transactions
for select to authenticated
using (
  exists (
    select 1
    from public.company_requests cr
    where cr.id = request_id
      and cr.user_id = auth.uid()
  )
  or public.has_role(auth.uid(), 'super_admin')
);

create policy "Admins can view org subscriptions" on public.organization_subscriptions
for select to authenticated
using (
  public.has_role(auth.uid(), 'super_admin')
  or organization_id = public.get_user_org(auth.uid())
);

create policy "Super admins can manage org subscriptions" on public.organization_subscriptions
for all to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));
