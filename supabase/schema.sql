-- Groundwork: one row per man, readable and writable only by him.
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.plans (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  profile    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;

drop policy if exists "a man reads his own plan"   on public.plans;
drop policy if exists "a man writes his own plan"  on public.plans;
drop policy if exists "a man changes his own plan" on public.plans;
drop policy if exists "a man removes his own plan" on public.plans;

create policy "a man reads his own plan"   on public.plans for select using (auth.uid() = user_id);
create policy "a man writes his own plan"  on public.plans for insert with check (auth.uid() = user_id);
create policy "a man changes his own plan" on public.plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "a man removes his own plan" on public.plans for delete using (auth.uid() = user_id);

-- keep updated_at honest
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists plans_touch on public.plans;
create trigger plans_touch before update on public.plans for each row execute function public.touch_updated_at();

-- Delete my account: removes the sign-in and, through the cascade, the plan row. Only the signed-in man can call it, and only on himself.
create or replace function public.delete_me() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_me() from public;
grant execute on function public.delete_me() to authenticated;
