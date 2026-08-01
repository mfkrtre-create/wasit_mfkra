alter table public.profiles
  alter column invite_only set default false;

update public.profiles
set invite_only = false
where invite_only = true;

drop policy if exists "invited users can create own profile" on public.profiles;
drop policy if exists "authenticated users can create own profile" on public.profiles;

create policy "authenticated users can create own profile" on public.profiles
  for insert
  with check (
    id = auth.uid()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and role = 'broker'
    and invite_only = false
  );
