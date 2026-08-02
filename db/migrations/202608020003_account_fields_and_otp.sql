alter table public.app_users
  add column if not exists username text,
  add column if not exists phone text not null default '',
  add column if not exists fal_license text not null default '';

update public.app_users
set phone = coalesce(nullif(phone, ''), regexp_replace(email, '[^a-zA-Z0-9]+', '_', 'g'))
where phone = '';

update public.app_users
set username = coalesce(nullif(username, ''), phone)
where username is null or username = '';

alter table public.app_users
  alter column phone drop default,
  alter column username set not null;

create unique index if not exists app_users_phone_unique_idx on public.app_users (phone);
create unique index if not exists app_users_username_lower_unique_idx on public.app_users (lower(username));
