-- ============================================================
-- CONSOLIDATED: Billing, Payments, CMS, Paystack Settings
-- Merges all payment migrations into one self-contained file
-- Safe to run on a fresh DB or one with partial migrations
-- ============================================================

-- ─── 1. company_requests: add billing columns ───
alter table public.company_requests
  add column if not exists selected_plan text not null default 'professional',
  add column if not exists selected_currency text not null default 'USD',
  add column if not exists paystack_reference text,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_amount integer not null default 0,
  add column if not exists payment_currency text not null default 'USD',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_metadata jsonb not null default '{}'::jsonb,
  add column if not exists payment_provider text not null default 'paystack',
  add column if not exists payment_reference text;

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

alter table public.company_requests
  drop constraint if exists company_requests_payment_provider_check;
alter table public.company_requests
  add constraint company_requests_payment_provider_check check (
    payment_provider = 'paystack'
  );

create unique index if not exists company_requests_paystack_reference_key
  on public.company_requests(paystack_reference)
  where paystack_reference is not null;

create unique index if not exists company_requests_payment_reference_key
  on public.company_requests(payment_reference)
  where payment_reference is not null;

-- ─── 2. payment_transactions ───
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
  add constraint payment_transactions_provider_check check (provider = 'paystack');

create unique index if not exists payment_transactions_payment_reference_key
  on public.payment_transactions(payment_reference)
  where payment_reference is not null;

alter table public.payment_transactions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'payment_transactions' and policyname = 'Company request owner can view payments') then
    create policy "Company request owner can view payments" on public.payment_transactions
    for select to authenticated
    using (
      exists (
        select 1 from public.company_requests cr
        where cr.id = request_id and cr.user_id = auth.uid()
      )
      or public.has_role(auth.uid(), 'super_admin')
    );
  end if;
end $$;

-- ─── 3. organization_subscriptions ───
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

alter table public.organization_subscriptions
  add column if not exists payment_provider text not null default 'paystack',
  add column if not exists payment_reference text;

alter table public.organization_subscriptions
  drop constraint if exists organization_subscriptions_payment_provider_check;
alter table public.organization_subscriptions
  add constraint organization_subscriptions_payment_provider_check check (payment_provider = 'paystack');

alter table public.organization_subscriptions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'organization_subscriptions' and policyname = 'Admins can view org subscriptions') then
    create policy "Admins can view org subscriptions" on public.organization_subscriptions
    for select to authenticated
    using (
      public.has_role(auth.uid(), 'super_admin')
      or organization_id = public.get_user_org(auth.uid())
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'organization_subscriptions' and policyname = 'Super admins can manage org subscriptions') then
    create policy "Super admins can manage org subscriptions" on public.organization_subscriptions
    for all to authenticated
    using (public.has_role(auth.uid(), 'super_admin'))
    with check (public.has_role(auth.uid(), 'super_admin'));
  end if;
end $$;

-- ─── 4. billing_plans ───
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
    'starter', 'Starter',
    'Perfect for small businesses with a single location.',
    5000, 'USD', '/month',
    '["1 service counter","Up to 3 services","Basic queue display","Token generation","Email support"]'::jsonb,
    'Choose Starter', false, true, 1
  ),
  (
    'professional', 'Professional',
    'For growing businesses needing advanced queue management.',
    10000, 'USD', '/month',
    '["Unlimited counters","Unlimited services","Priority queuing (VIP/Urgent)","Audio announcements","Analytics & reports","Thermal ticket printing","Staff management","Priority support"]'::jsonb,
    'Choose Professional', true, true, 2
  ),
  (
    'enterprise', 'Enterprise',
    'Multi-branch operations with full feature access.',
    15000, 'USD', '/month',
    '["Everything in Professional","Multi-branch support","Advanced queue alerts","Custom branding","API access","Dedicated account manager","SLA guarantee"]'::jsonb,
    'Choose Enterprise', false, true, 3
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

alter table public.billing_plans enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'billing_plans' and policyname = 'Anyone can view active billing plans') then
    create policy "Anyone can view active billing plans" on public.billing_plans
    for select to anon, authenticated
    using (is_active = true or public.has_role(auth.uid(), 'super_admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'billing_plans' and policyname = 'Super admins can manage billing plans') then
    create policy "Super admins can manage billing plans" on public.billing_plans
    for all to authenticated
    using (public.has_role(auth.uid(), 'super_admin'))
    with check (public.has_role(auth.uid(), 'super_admin'));
  end if;
end $$;

-- ─── 5. platform_payment_settings ───
create table if not exists public.platform_payment_settings (
  id integer primary key default 1,
  default_provider text not null default 'paystack',
  commission_type text not null default 'percentage',
  commission_value numeric(8,4) not null default 2.5000,
  commission_flat_amount integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_payment_settings_singleton check (id = 1),
  constraint platform_payment_settings_commission_type_check check (commission_type in ('percentage', 'flat')),
  constraint platform_payment_settings_commission_value_check check (commission_value >= 0),
  constraint platform_payment_settings_commission_flat_amount_check check (commission_flat_amount >= 0)
);

-- Drop old provider check that allowed flutterwave, add paystack-only
alter table public.platform_payment_settings
  drop constraint if exists platform_payment_settings_provider_check;
alter table public.platform_payment_settings
  add constraint platform_payment_settings_provider_check check (default_provider = 'paystack');

insert into public.platform_payment_settings (id)
values (1)
on conflict (id) do nothing;

-- Add Paystack admin-configurable columns
alter table public.platform_payment_settings
  add column if not exists paystack_public_key text,
  add column if not exists paystack_secret_key text,
  add column if not exists paystack_callback_url text,
  add column if not exists paystack_test_mode boolean not null default true;

alter table public.platform_payment_settings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'platform_payment_settings' and policyname = 'Authenticated can view payment settings') then
    create policy "Authenticated can view payment settings" on public.platform_payment_settings
      for select to authenticated using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'platform_payment_settings' and policyname = 'Super admins can manage payment settings') then
    create policy "Super admins can manage payment settings" on public.platform_payment_settings
      for all to authenticated
      using (public.has_role(auth.uid(), 'super_admin'))
      with check (public.has_role(auth.uid(), 'super_admin'));
  end if;
end $$;

-- ─── 6. site_content (CMS) ───
create table if not exists public.site_content (
  id text primary key,
  section text not null,
  label text not null,
  content_type text not null default 'text',
  value text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_content_type_check check (content_type in ('text', 'json', 'html', 'number'))
);

alter table public.site_content enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'site_content' and policyname = 'Anyone can read site content') then
    create policy "Anyone can read site content" on public.site_content
      for select to anon, authenticated using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'site_content' and policyname = 'Super admins can manage site content') then
    create policy "Super admins can manage site content" on public.site_content
      for all to authenticated
      using (public.has_role(auth.uid(), 'super_admin'))
      with check (public.has_role(auth.uid(), 'super_admin'));
  end if;
end $$;

-- ─── 7. Seed default site content ───
insert into public.site_content (id, section, label, content_type, value, sort_order)
values
  ('hero_title', 'hero', 'Hero Title', 'text', 'Eliminate Waiting Lines with Smart Queue Management', 1),
  ('hero_subtitle', 'hero', 'Hero Subtitle', 'text', 'Transform customer flow using self-service kiosks, live display boards, and powerful staff dashboards. Deliver a seamless digital queue experience that customers love.', 2),
  ('hero_badge', 'hero', 'Hero Badge Text', 'text', 'Built for modern service centers', 3),
  ('hero_cta_primary', 'hero', 'Primary CTA Text', 'text', 'Start Free Trial', 4),
  ('hero_cta_secondary', 'hero', 'Secondary CTA Text', 'text', 'Request Demo', 5),
  ('hero_stat_1_value', 'hero', 'Stat 1 Value', 'text', '47%', 6),
  ('hero_stat_1_label', 'hero', 'Stat 1 Label', 'text', 'Faster Service', 7),
  ('hero_stat_2_value', 'hero', 'Stat 2 Value', 'text', '99.9%', 8),
  ('hero_stat_2_label', 'hero', 'Stat 2 Label', 'text', 'Uptime', 9),
  ('hero_stat_3_value', 'hero', 'Stat 3 Value', 'text', '10K+', 10),
  ('hero_stat_3_label', 'hero', 'Stat 3 Label', 'text', 'Tokens / Day', 11),
  ('brand_name', 'brand', 'Brand Name', 'text', 'Smart Queue', 1),
  ('brand_tagline', 'brand', 'Brand Tagline', 'text', 'Queue Management SaaS', 2),
  ('brand_letter', 'brand', 'Brand Letter (Icon)', 'text', 'Q', 3),
  ('features_title', 'features', 'Features Section Title', 'text', 'Everything You Need to Manage Queues', 1),
  ('features_subtitle', 'features', 'Features Section Subtitle', 'text', 'From self-service kiosks to real-time analytics — a complete toolkit for modern queue management.', 2),
  ('features_list', 'features', 'Feature Cards (JSON Array)', 'json', '[{"title":"Self-Service Kiosk","description":"Touchscreen interface for instant service selection and token generation with thermal printing.","icon":"ScanLine"},{"title":"Live Queue Display","description":"Real-time display boards with audio announcements and multi-counter support.","icon":"MonitorSmartphone"},{"title":"Staff Dashboard","description":"Call, recall, skip, transfer tokens. Full queue control from an intuitive panel.","icon":"LayoutDashboard"},{"title":"Analytics & Reports","description":"Track peak hours, waiting times, and service trends with exportable reports.","icon":"BarChart3"},{"title":"Mobile Queue via QR","description":"Customers scan QR to join queue remotely and track position from their phone.","icon":"QrCode"},{"title":"Audio Announcements","description":"Text-to-speech system announces token numbers and counter assignments automatically.","icon":"Volume2"},{"title":"Thermal Ticket Printing","description":"Print queue tickets with token, QR code, service info and estimated wait time.","icon":"Printer"},{"title":"Smart Notifications","description":"In-app reminders and display alerts as a customer''s turn approaches.","icon":"Bell"},{"title":"Priority Queuing","description":"VIP, elderly, and urgent case prioritization with intelligent queue ordering.","icon":"Zap"}]', 3),
  ('how_it_works_title', 'how_it_works', 'Section Title', 'text', 'How It Works', 1),
  ('how_it_works_subtitle', 'how_it_works', 'Section Subtitle', 'text', 'Simple 4-step process from arrival to service completion.', 2),
  ('how_it_works_steps', 'how_it_works', 'Steps (JSON Array)', 'json', '[{"step":"01","title":"Customer selects service","description":"Visitors choose the required service at a self-service kiosk in seconds."},{"step":"02","title":"Token is generated","description":"A smart digital token is generated instantly with queue priority rules."},{"step":"03","title":"Staff calls customer","description":"Staff dashboard shows the next token and allows quick customer calling."},{"step":"04","title":"Display updates live","description":"Queue display screens update in real-time for transparent waiting."}]', 3),
  ('testimonials_title', 'testimonials', 'Section Title', 'text', 'Loved by Teams Everywhere', 1),
  ('testimonials_list', 'testimonials', 'Testimonials (JSON Array)', 'json', '[{"quote":"Smart Queue reduced our average wait times by 52%. Customers love the transparency of knowing exactly where they are in the queue.","author":"Sarah Mitchell","role":"Operations Manager, City Hospital","rating":5},{"quote":"The kiosk interface is incredibly intuitive. Our elderly customers can use it without any assistance, and the priority queue is a game changer.","author":"James Rodriguez","role":"Branch Manager, Metro Bank","rating":5},{"quote":"Setting up was painless. Within an hour, we had our entire service center running on Smart Queue with real-time displays on every floor.","author":"Priya Sharma","role":"COO, TechServ Solutions","rating":5}]', 2),
  ('trusted_by_label', 'trusted_by', 'Section Label', 'text', 'Trusted by service centers worldwide', 1),
  ('trusted_by_list', 'trusted_by', 'Trusted By Items (JSON Array)', 'json', '["🏥 Hospitals","🏦 Banks","🏛️ Government","📡 Telecom","🛫 Airlines","🎓 Universities"]', 2),
  ('cta_title', 'cta', 'CTA Title', 'text', 'Ready to Transform Your Customer Experience?', 1),
  ('cta_subtitle', 'cta', 'CTA Subtitle', 'text', 'Join thousands of service centers already using Smart Queue. Start your free 14-day trial today.', 2),
  ('cta_primary', 'cta', 'CTA Primary Button', 'text', 'Start Free Trial', 3),
  ('cta_secondary', 'cta', 'CTA Secondary Button', 'text', 'Contact Sales', 4),
  ('pricing_title', 'pricing', 'Pricing Title', 'text', 'Plans That Scale With You', 1),
  ('pricing_subtitle', 'pricing', 'Pricing Subtitle', 'text', 'Transparent monthly pricing built for serious operations.', 2),
  ('pricing_badges', 'pricing', 'Pricing Trust Badges (JSON Array)', 'json', '["No hidden fees","Cancel anytime","Instant activation after approval"]', 3),
  ('footer_description', 'footer', 'Footer Description', 'text', 'The modern queue management platform for customer-centric businesses.', 1),
  ('footer_copyright', 'footer', 'Copyright Text', 'text', 'Smart Queue. All rights reserved.', 2),
  ('saas_title', 'saas', 'SaaS Section Title', 'text', 'Enterprise-Ready Cloud Platform', 1),
  ('saas_subtitle', 'saas', 'SaaS Section Subtitle', 'text', 'Built for scale with multi-tenant architecture, automatic backups, and global deployment capability. Designed for reliability and security.', 2),
  ('saas_features', 'saas', 'SaaS Feature Cards (JSON Array)', 'json', '[{"title":"Multi-Tenant Architecture","text":"Securely manage multiple organizations from one platform."},{"title":"Cloud Infrastructure","text":"99.9% uptime with global CDN and automatic scaling."},{"title":"Enterprise Security","text":"SOC 2 compliant with role-based access control."},{"title":"Global Deployment","text":"Deploy kiosks and displays across unlimited branches."}]', 3)
on conflict (id) do nothing;

-- ─── 8. Seed default billing_plan_prices for USD ───
create table if not exists public.billing_plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.billing_plans(id) on delete cascade,
  currency text not null,
  amount integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, currency)
);

alter table public.billing_plan_prices enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'billing_plan_prices' and policyname = 'Anyone can view active prices') then
    create policy "Anyone can view active prices" on public.billing_plan_prices
    for select to anon, authenticated
    using (is_active = true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'billing_plan_prices' and policyname = 'Super admins can manage prices') then
    create policy "Super admins can manage prices" on public.billing_plan_prices
    for all to authenticated
    using (public.has_role(auth.uid(), 'super_admin'))
    with check (public.has_role(auth.uid(), 'super_admin'));
  end if;
end $$;

insert into public.billing_plan_prices (plan_id, currency, amount, is_active)
values
  ('starter',      'USD', 5000,  true),
  ('professional', 'USD', 10000, true),
  ('enterprise',   'USD', 15000, true)
on conflict (plan_id, currency) do nothing;
