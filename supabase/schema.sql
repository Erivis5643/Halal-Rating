-- Enable auth.uid() access
create schema if not exists app;
create extension if not exists "pgcrypto";

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  role text check (role in ('user','admin')) default 'user',
  total_trophies integer not null default 0,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create or replace function public.handle_profile_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.handle_profile_updated();

-- Awards catalog
create table if not exists public.awards (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text,
  created_at timestamp with time zone default now()
);

-- User awards (many-to-many)
create table if not exists public.user_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  award_id uuid not null references public.awards(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(user_id, award_id)
);

-- Events (future & past)
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'event_kind' and n.nspname = 'public'
  ) then
    create type public.event_kind as enum ('past','future');
  end if;
end
$$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  kind public.event_kind not null,
  name text not null,
  description text,
  event_date date,
  trophy_amount integer default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- Participants for past events earning trophies
create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trophies_awarded integer not null default 0,
  photos text[] default array[]::text[],
  created_at timestamp with time zone default now()
);

-- RLS policies
alter table public.profiles enable row level security;
alter table public.awards enable row level security;
alter table public.user_awards enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;

-- Profiles: users can read all, update their own; admins can update any
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_read on public.profiles for select using (true);
create policy profiles_insert_self on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_self on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Awards: anyone read; only admins insert
drop policy if exists awards_read on public.awards;
create policy awards_read on public.awards for select using (true);

-- User awards: users can read their own; admins grant
drop policy if exists user_awards_read_self on public.user_awards;
drop policy if exists user_awards_read_all on public.user_awards;
create policy user_awards_read_self on public.user_awards for select using (auth.uid() = user_id);
-- Public profile needs to show awards; allow public read
create policy user_awards_read_all on public.user_awards for select using (true);

-- Events: read all; only admins insert/update/delete
drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (true);

-- Event participants: users can read where they are participant; admins manage
drop policy if exists event_participants_read on public.event_participants;
drop policy if exists event_participants_read_all on public.event_participants;
create policy event_participants_read on public.event_participants for select using (auth.uid() = user_id);
-- Public profile needs to show events; allow public read
create policy event_participants_read_all on public.event_participants for select using (true);

-- Helper: is_admin() checks
create or replace function public.is_admin() returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Admin grants via SECURITY DEFINER RPCs
create or replace function public.admin_insert_award(p_name text, p_emoji text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  insert into public.awards(name, emoji) values (p_name, p_emoji) returning id into new_id;
  return new_id;
end;$$;
grant execute on function public.admin_insert_award(text, text) to authenticated;

create or replace function public.admin_create_event(
  p_kind public.event_kind,
  p_name text,
  p_description text,
  p_event_date date,
  p_trophy_amount integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  insert into public.events(kind, name, description, event_date, trophy_amount, created_by)
  values (p_kind, p_name, p_description, p_event_date, p_trophy_amount, auth.uid())
  returning id into new_id;
  return new_id;
end;$$;
grant execute on function public.admin_create_event(public.event_kind, text, text, date, integer) to authenticated;

create or replace function public.admin_add_event_participant(
  p_event uuid,
  p_user uuid,
  p_trophies integer,
  p_photos text[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  insert into public.event_participants(event_id, user_id, trophies_awarded, photos)
  values (p_event, p_user, p_trophies, coalesce(p_photos, array[]::text[]))
  returning id into new_id;
  update public.profiles set total_trophies = total_trophies + p_trophies where id = p_user;
  return new_id;
end;$$;
grant execute on function public.admin_add_event_participant(uuid, uuid, integer, text[]) to authenticated;

-- Grant award to user (admin)
-- Use argument order (p_award, p_user) to match RPC cache expectations
create or replace function public.admin_grant_award(
  p_award uuid,
  p_user uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  insert into public.user_awards(user_id, award_id) values (p_user, p_award)
  on conflict (user_id, award_id) do nothing
  returning id into new_id;
  if new_id is not null then
    update public.profiles set total_trophies = total_trophies + 50 where id = p_user;
  end if;
  return coalesce(new_id, gen_random_uuid()); -- return a synthetic id if it already existed
end;$$;
grant execute on function public.admin_grant_award(uuid, uuid) to authenticated;

-- Admin remove a user's award
create or replace function public.admin_remove_user_award(
  p_user uuid,
  p_award uuid
) returns void language plpgsql security definer set search_path = public as $$
declare removed_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.user_awards where user_id = p_user and award_id = p_award returning id into removed_id;
  if removed_id is not null then
    update public.profiles set total_trophies = greatest(0, total_trophies - 50) where id = p_user;
  end if;
end;$$;
grant execute on function public.admin_remove_user_award(uuid, uuid) to authenticated;

-- Admin remove an event participation and decrement trophies accordingly
create or replace function public.admin_remove_event_participation(
  p_participation_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_trophies int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select user_id, trophies_awarded into v_user, v_trophies from public.event_participants where id = p_participation_id;
  if v_user is not null then
    delete from public.event_participants where id = p_participation_id;
    update public.profiles set total_trophies = greatest(0, total_trophies - coalesce(v_trophies,0)) where id = v_user;
  end if;
end;$$;
grant execute on function public.admin_remove_event_participation(uuid) to authenticated;

-- Admin delete future event
create or replace function public.admin_delete_event(
  p_event uuid
) returns void language plpgsql security definer set search_path = public as $$
declare k public.event_kind;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select kind into k from public.events where id = p_event;
  if k = 'future' then
    delete from public.events where id = p_event;
  else
    raise exception 'only future events can be deleted via this RPC';
  end if;
end;$$;
grant execute on function public.admin_delete_event(uuid) to authenticated;

