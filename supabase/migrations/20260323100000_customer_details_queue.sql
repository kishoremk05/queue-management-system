-- Add optional customer details to queue tokens
alter table public.tokens
add column if not exists customer_name text,
add column if not exists customer_phone text,
add column if not exists visit_reason text,
add column if not exists notification_channel text,
add column if not exists notification_opt_in boolean default false;

alter table public.tokens
drop constraint if exists tokens_notification_channel_check;

alter table public.tokens
add constraint tokens_notification_channel_check check (
  notification_channel is null or notification_channel in ('none', 'sms', 'whatsapp')
);
