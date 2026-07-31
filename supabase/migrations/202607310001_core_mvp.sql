create extension if not exists pgcrypto;

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role <> new.role and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Only admins can change profile roles.';
  end if;
  return new;
end;
$$;

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'broker' check (role in ('broker', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (email)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'وسيط عقاري',
  email text not null,
  phone text not null default '',
  role text not null default 'broker' check (role in ('broker', 'admin')),
  fal_license text not null default '',
  timezone text not null default 'Asia/Riyadh',
  default_reminder_days integer not null default 14 check (default_reminder_days between 1 and 365),
  invite_only boolean not null default true,
  smtp_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  type text not null default 'buyer',
  priority text not null default 'warm',
  notes text not null default '',
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.property_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  kind text not null check (kind in ('offer', 'request')),
  status text not null,
  transaction_type text not null default '',
  category text not null default '',
  property_type text not null default '',
  title text not null default '',
  city text not null default '',
  district text not null default '',
  price numeric,
  budget numeric,
  area numeric,
  price_per_meter numeric,
  age text not null default '',
  frontage text not null default '',
  street_width numeric,
  plan_number text not null default '',
  block_number text not null default '',
  parcel_number text not null default '',
  fal_license text not null default '',
  ad_license text not null default '',
  owner_name text not null default '',
  owner_phone text not null default '',
  contact text not null default '',
  latitude double precision,
  longitude double precision,
  notes text not null default '',
  tags text[] not null default '{}',
  source text not null default 'manual',
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint property_records_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint property_records_longitude_range check (longitude is null or longitude between -180 and 180)
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid references public.property_records(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'due' check (status in ('due', 'done', 'snoozed')),
  message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  type text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invites_email_idx on public.invites (lower(email));
create index if not exists clients_user_id_idx on public.clients (user_id);
create index if not exists property_records_user_id_idx on public.property_records (user_id);
create index if not exists property_records_location_idx on public.property_records (latitude, longitude) where latitude is not null and longitude is not null;
create index if not exists reminders_user_due_idx on public.reminders (user_id, due_at);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation before update on public.profiles for each row execute function public.prevent_profile_role_escalation();
drop trigger if exists workspace_snapshots_set_updated_at on public.workspace_snapshots;
create trigger workspace_snapshots_set_updated_at before update on public.workspace_snapshots for each row execute function public.set_updated_at();
drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();
drop trigger if exists property_records_set_updated_at on public.property_records;
create trigger property_records_set_updated_at before update on public.property_records for each row execute function public.set_updated_at();
drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at before update on public.reminders for each row execute function public.set_updated_at();

alter table public.invites enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_snapshots enable row level security;
alter table public.clients enable row level security;
alter table public.property_records enable row level security;
alter table public.reminders enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "admins can manage invites" on public.invites;
create policy "admins can manage invites" on public.invites
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "users can read own invite" on public.invites;
create policy "users can read own invite" on public.invites
  for select using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile" on public.profiles for select using (id = auth.uid());
drop policy if exists "invited users can create own profile" on public.profiles;
create policy "invited users can create own profile" on public.profiles
  for insert with check (
    id = auth.uid()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and exists (
      select 1 from public.invites i
      where lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and i.status in ('pending', 'accepted')
        and i.role = profiles.role
    )
  );
drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "users own workspace snapshots" on public.workspace_snapshots;
create policy "users own workspace snapshots" on public.workspace_snapshots for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own clients" on public.clients;
create policy "users own clients" on public.clients for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own property records" on public.property_records;
create policy "users own property records" on public.property_records for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own reminders" on public.reminders;
create policy "users own reminders" on public.reminders for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own notifications" on public.notifications;
create policy "users own notifications" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
