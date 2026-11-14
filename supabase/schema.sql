-- Groundwork: one row per man, readable and writable only by him.
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.plans (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  profile    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;

-- signed-in men may use the table; the policies below narrow that to each man's own row. Anonymous visitors get nothing.
grant select, insert, update, delete on public.plans to authenticated;
revoke all on public.plans from anon;

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
  if new.profile is distinct from old.profile then new.updated_at = now(); end if;
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

-- ===================== Check-ins (milestone 4) =====================
-- How often he wants one, when the last went out, and what the check-ins have counted (days of cattle work).
alter table public.plans add column if not exists checkin      text not null default 'off';
alter table public.plans add column if not exists checkin_last timestamptz;
alter table public.plans add column if not exists state        jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.plans add constraint plans_checkin_ok check (checkin in ('off', 'weekly', 'monthly'));
exception when duplicate_object then null; end $$;

-- One row per check-in sent. The token is the private key in the email's buttons.
create table if not exists public.checkins (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  token       text not null unique,
  stage       text not null,
  cadence     text not null,
  sent_at     timestamptz not null default now(),
  answered_at timestamptz,
  answers     jsonb not null default '{}'::jsonb
);
create index if not exists checkins_user on public.checkins (user_id, sent_at desc);
alter table public.checkins enable row level security;
grant select on public.checkins to authenticated;
revoke all on public.checkins from anon;
grant all on public.checkins to service_role;
grant all on public.plans to service_role;
drop policy if exists "a man reads his own check-ins" on public.checkins;
create policy "a man reads his own check-ins" on public.checkins for select using (auth.uid() = user_id);

-- Open a check-in from the email link: his plan and the check-in, for that token only, for 45 days.
create or replace function public.checkin_open(tok text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.checkins; p public.plans;
begin
  select * into c from public.checkins where token = tok and sent_at > now() - interval '45 days';
  if not found then return null; end if;
  select * into p from public.plans where user_id = c.user_id;
  return jsonb_build_object('id', c.id, 'stage', c.stage, 'cadence', c.cadence, 'sent_at', c.sent_at, 'answers', c.answers,
    'profile', coalesce(p.profile, '{}'::jsonb), 'state', coalesce(p.state, '{}'::jsonb), 'checkin', p.checkin);
end $$;

-- Record his answers and the plan they move. Same token, same 45 days; sizes kept small.
create or replace function public.checkin_answer(tok text, answers jsonb, new_profile jsonb, new_state jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare c public.checkins;
begin
  select * into c from public.checkins where token = tok and sent_at > now() - interval '45 days';
  if not found then return false; end if;
  if pg_column_size(answers) > 4000 or pg_column_size(new_profile) > 20000 or pg_column_size(new_state) > 20000 then raise exception 'too large'; end if;
  if jsonb_typeof(answers) <> 'object' or jsonb_typeof(new_profile) <> 'object' or jsonb_typeof(new_state) <> 'object' then raise exception 'bad answer'; end if;
  update public.checkins set answers = checkin_answer.answers, answered_at = now() where id = c.id;
  update public.plans set profile = new_profile, state = new_state where user_id = c.user_id;
  return true;
end $$;

-- Stop check-ins from the link in any check-in.
create or replace function public.checkin_stop(tok text) returns boolean
language plpgsql security definer set search_path = public as $$
declare c public.checkins;
begin
  select * into c from public.checkins where token = tok;
  if not found then return false; end if;
  update public.plans set checkin = 'off' where user_id = c.user_id;
  return true;
end $$;

revoke all on function public.checkin_open(text) from public;
revoke all on function public.checkin_answer(text, jsonb, jsonb, jsonb) from public;
revoke all on function public.checkin_stop(text) from public;
grant execute on function public.checkin_open(text) to anon, authenticated;
grant execute on function public.checkin_answer(text, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.checkin_stop(text) to anon, authenticated;

-- Who is due a check-in today. Only the sender, with the secret key, may call it.
create or replace function public.checkins_due() returns table (user_id uuid, email text, profile jsonb, state jsonb, checkin text)
language sql security definer set search_path = public, auth as $$
  select p.user_id, u.email::text, p.profile, p.state, p.checkin
  from public.plans p join auth.users u on u.id = p.user_id
  where p.checkin <> 'off' and u.email is not null and p.profile <> '{}'::jsonb
    and (p.checkin_last is null or p.checkin_last < now() - case p.checkin when 'weekly' then interval '6 days 12 hours' else interval '29 days 12 hours' end)
$$;
revoke all on function public.checkins_due() from public, anon, authenticated;
grant execute on function public.checkins_due() to service_role;
