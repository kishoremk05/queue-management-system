
-- Create app_role enum
create type public.app_role as enum ('super_admin', 'company_admin', 'staff');

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Company requests
create table public.company_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_name text not null,
  admin_name text not null,
  email text not null,
  status text not null default 'pending',
  created_at timestamptz default now()
);

-- Services
create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  prefix char(1) not null default 'A',
  created_at timestamptz default now()
);

-- Counters
create table public.counters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  service_id uuid references public.services(id) on delete cascade,
  counter_number int not null,
  created_at timestamptz default now()
);

-- Tokens
create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  service_id uuid references public.services(id) on delete cascade not null,
  token_number text not null,
  status text not null default 'waiting',
  counter_id uuid references public.counters(id) on delete set null,
  created_at timestamptz default now()
);

-- Staff requests
create table public.staff_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  email text not null,
  status text not null default 'pending',
  created_at timestamptz default now()
);

-- User roles (separate table as required)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  unique (user_id, role)
);

-- Profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  name text not null,
  email text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz default now()
);

-- Enable RLS on all tables
alter table public.organizations enable row level security;
alter table public.company_requests enable row level security;
alter table public.services enable row level security;
alter table public.counters enable row level security;
alter table public.tokens enable row level security;
alter table public.staff_requests enable row level security;
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;

-- Security definer function: check role
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Security definer function: get user org
create or replace function public.get_user_org(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.user_roles
  where user_id = _user_id limit 1
$$;

-- Generate token function
create or replace function public.generate_token(_service_id uuid, _org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _prefix char;
  _count int;
  _token text;
begin
  select upper(left(name, 1)) into _prefix from public.services where id = _service_id;
  select count(*) + 1 into _count from public.tokens
    where service_id = _service_id and created_at::date = current_date;
  _token := _prefix || lpad(_count::text, 3, '0');
  insert into public.tokens (organization_id, service_id, token_number, status)
    values (_org_id, _service_id, _token, 'waiting');
  return _token;
end;
$$;

-- RLS Policies

-- company_requests
create policy "Anyone can submit company request" on public.company_requests for insert to anon, authenticated with check (true);
create policy "Super admins can view requests" on public.company_requests for select to authenticated using (public.has_role(auth.uid(), 'super_admin'));
create policy "Super admins can update requests" on public.company_requests for update to authenticated using (public.has_role(auth.uid(), 'super_admin'));

-- organizations
create policy "Members can view own org" on public.organizations for select to authenticated using (
  id = public.get_user_org(auth.uid()) or public.has_role(auth.uid(), 'super_admin')
);
create policy "Super admins can insert orgs" on public.organizations for insert to authenticated with check (public.has_role(auth.uid(), 'super_admin'));

-- user_roles
create policy "Users can view own role" on public.user_roles for select to authenticated using (
  user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin')
);
create policy "Admins can insert roles" on public.user_roles for insert to authenticated with check (
  public.has_role(auth.uid(), 'super_admin') or
  (public.has_role(auth.uid(), 'company_admin') and organization_id = public.get_user_org(auth.uid()))
);

-- profiles
create policy "Users can view relevant profiles" on public.profiles for select to authenticated using (
  user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin') or organization_id = public.get_user_org(auth.uid())
);
create policy "Admins can insert profiles" on public.profiles for insert to authenticated with check (
  user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin') or
  (public.has_role(auth.uid(), 'company_admin') and organization_id = public.get_user_org(auth.uid()))
);
create policy "Users can update own profile" on public.profiles for update to authenticated using (user_id = auth.uid());

-- services (readable by anyone for kiosk, manageable by company admin)
create policy "Anyone can view services" on public.services for select to anon, authenticated using (true);
create policy "Company admins can insert services" on public.services for insert to authenticated with check (
  organization_id = public.get_user_org(auth.uid()) and public.has_role(auth.uid(), 'company_admin')
);
create policy "Company admins can update services" on public.services for update to authenticated using (
  organization_id = public.get_user_org(auth.uid()) and public.has_role(auth.uid(), 'company_admin')
);
create policy "Company admins can delete services" on public.services for delete to authenticated using (
  organization_id = public.get_user_org(auth.uid()) and public.has_role(auth.uid(), 'company_admin')
);

-- counters
create policy "Anyone can view counters" on public.counters for select to anon, authenticated using (true);
create policy "Company admins can insert counters" on public.counters for insert to authenticated with check (
  organization_id = public.get_user_org(auth.uid()) and public.has_role(auth.uid(), 'company_admin')
);
create policy "Company admins can update counters" on public.counters for update to authenticated using (
  organization_id = public.get_user_org(auth.uid()) and public.has_role(auth.uid(), 'company_admin')
);
create policy "Company admins can delete counters" on public.counters for delete to authenticated using (
  organization_id = public.get_user_org(auth.uid()) and public.has_role(auth.uid(), 'company_admin')
);

-- tokens (public for kiosk/display)
create policy "Anyone can view tokens" on public.tokens for select to anon, authenticated using (true);
create policy "Anyone can insert tokens" on public.tokens for insert to anon, authenticated with check (true);
create policy "Staff can update tokens" on public.tokens for update to authenticated using (
  organization_id = public.get_user_org(auth.uid())
);

-- staff_requests
create policy "Anyone can submit staff request" on public.staff_requests for insert to anon, authenticated with check (true);
create policy "Company admins can view staff requests" on public.staff_requests for select to authenticated using (
  organization_id = public.get_user_org(auth.uid()) and public.has_role(auth.uid(), 'company_admin')
);
create policy "Company admins can update staff requests" on public.staff_requests for update to authenticated using (
  organization_id = public.get_user_org(auth.uid()) and public.has_role(auth.uid(), 'company_admin')
);

-- Enable realtime for tokens
alter publication supabase_realtime add table tokens;
