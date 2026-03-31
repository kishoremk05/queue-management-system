-- Enforce Paystack-only processing across billing tables

update public.platform_payment_settings
set default_provider = 'paystack',
    updated_at = now()
where id = 1;

update public.company_requests
set payment_provider = 'paystack'
where payment_provider is distinct from 'paystack';

update public.payment_transactions
set provider = 'paystack'
where provider is distinct from 'paystack';

update public.organization_subscriptions
set payment_provider = 'paystack'
where payment_provider is distinct from 'paystack';

alter table public.platform_payment_settings
drop constraint if exists platform_payment_settings_provider_check;

alter table public.platform_payment_settings
add constraint platform_payment_settings_provider_check check (default_provider = 'paystack');

alter table public.company_requests
drop constraint if exists company_requests_payment_provider_check;

alter table public.company_requests
add constraint company_requests_payment_provider_check check (payment_provider = 'paystack');

alter table public.payment_transactions
drop constraint if exists payment_transactions_provider_check;

alter table public.payment_transactions
add constraint payment_transactions_provider_check check (provider = 'paystack');

alter table public.organization_subscriptions
drop constraint if exists organization_subscriptions_payment_provider_check;

alter table public.organization_subscriptions
add constraint organization_subscriptions_payment_provider_check check (payment_provider = 'paystack');
