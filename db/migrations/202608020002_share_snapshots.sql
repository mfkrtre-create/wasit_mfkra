create table if not exists public.share_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  record_id text not null,
  token_hash text not null unique,
  title text not null,
  snapshot jsonb not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists share_snapshots_user_created_idx on public.share_snapshots (user_id, created_at desc);
create index if not exists share_snapshots_record_idx on public.share_snapshots (user_id, record_id);
create index if not exists share_snapshots_token_hash_idx on public.share_snapshots (token_hash);
