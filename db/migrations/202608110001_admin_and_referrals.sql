alter table public.app_users
  add column if not exists is_active boolean not null default true,
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.app_users(id) on delete set null;

update public.app_users
set referral_code = 'BROKER-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where referral_code is null or referral_code = '';

alter table public.app_users
  alter column referral_code set default ('BROKER-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8))),
  alter column referral_code set not null;
create unique index if not exists app_users_referral_code_unique_idx on public.app_users (upper(referral_code));

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.app_users(id) on delete set null,
  action text not null,
  target_user_id uuid references public.app_users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);
