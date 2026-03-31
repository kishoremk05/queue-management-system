-- Add queue priority metadata to tokens
alter table public.tokens
add column if not exists priority_level text not null default 'normal',
add column if not exists priority_rank int not null default 4;

-- Ensure only supported priority values are stored
alter table public.tokens
drop constraint if exists tokens_priority_level_check;

alter table public.tokens
add constraint tokens_priority_level_check check (
    priority_level in (
        'normal',
        'vip',
        'elderly',
        'urgent'
    )
);

-- Ensure ranks map to the expected levels
alter table public.tokens
drop constraint if exists tokens_priority_rank_check;

alter table public.tokens
add constraint tokens_priority_rank_check check (priority_rank between 1 and 4);

-- Generate token with explicit priority and configured service prefix
create or replace function public.generate_token_with_priority(
  _service_id uuid,
  _org_id uuid,
  _priority_level text default 'normal'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _prefix char;
  _count int;
  _token text;
  _normalized_priority text;
  _priority_rank int;
begin
  _normalized_priority := lower(coalesce(_priority_level, 'normal'));

  if _normalized_priority not in ('normal', 'vip', 'elderly', 'urgent') then
    _normalized_priority := 'normal';
  end if;

  _priority_rank := case _normalized_priority
    when 'urgent' then 1
    when 'vip' then 2
    when 'elderly' then 3
    else 4
  end;

  select coalesce(prefix, upper(left(name, 1)))
    into _prefix
    from public.services
    where id = _service_id;

  if _prefix is null then
    raise exception 'Service not found';
  end if;

  select count(*) + 1 into _count
    from public.tokens
    where service_id = _service_id
      and created_at::date = current_date;

  _token := upper(_prefix) || lpad(_count::text, 3, '0');

  insert into public.tokens (organization_id, service_id, token_number, status, priority_level, priority_rank)
  values (_org_id, _service_id, _token, 'waiting', _normalized_priority, _priority_rank);

  return _token;
end;
$$;

-- Keep backward compatibility while fixing prefix behavior
create or replace function public.generate_token(_service_id uuid, _org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.generate_token_with_priority(_service_id, _org_id, 'normal');
end;
$$;