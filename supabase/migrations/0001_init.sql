-- Venue Connect: initial schema
-- Run this in the Supabase SQL editor (or with `supabase db push`).

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table public.venues (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name             text not null check (char_length(name) between 1 and 80),
  logo_url         text,
  visibility_hours int  not null default 24 check (visibility_hours between 1 and 168),
  message_cap      int  not null default 10 check (message_cap between 2 and 50),
  chat_hours       int  not null default 24 check (chat_hours between 1 and 168),
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create table public.venue_admins (
  venue_id uuid not null references public.venues on delete cascade,
  user_id  uuid not null references auth.users on delete cascade,
  primary key (venue_id, user_id)
);

create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  bio          text check (char_length(bio) <= 200),
  photo_url    text,
  intents      text[] not null default '{}' check (intents <@ array['chat','friends','dating']::text[] and cardinality(intents) > 0),
  interests    text[] not null default '{}' check (cardinality(interests) <= 10),
  public_key   jsonb,                       -- ECDH P-256 public key (JWK) for end-to-end encrypted chat
  is_adult     boolean not null check (is_adult),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- A profile published at a venue, visible until expires_at
create table public.venue_posts (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  published_at timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index venue_posts_active_idx on public.venue_posts (venue_id, expires_at);
create index venue_posts_user_idx   on public.venue_posts (user_id, venue_id);

-- Likes and passes
create table public.swipes (
  venue_id   uuid not null references public.venues on delete cascade,
  from_id    uuid not null references auth.users on delete cascade,
  to_id      uuid not null references auth.users on delete cascade,
  liked      boolean not null,
  created_at timestamptz not null default now(),
  primary key (venue_id, from_id, to_id),
  check (from_id <> to_id)
);

create table public.matches (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues on delete cascade,
  user_a           uuid not null references auth.users on delete cascade,
  user_b           uuid not null references auth.users on delete cascade,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  a_shared_contact boolean not null default false,
  b_shared_contact boolean not null default false,
  unique (venue_id, user_a, user_b),
  check (user_a < user_b)
);
create index matches_a_idx on public.matches (user_a);
create index matches_b_idx on public.matches (user_b);

-- Messages are stored encrypted. The server never sees plaintext.
create table public.messages (
  id         bigint generated always as identity primary key,
  match_id   uuid not null references public.matches on delete cascade,
  sender_id  uuid not null default auth.uid() references auth.users on delete cascade,
  ciphertext text not null check (char_length(ciphertext) <= 4000),
  iv         text not null check (char_length(iv) <= 64),
  is_contact boolean not null default false,  -- contact-share messages don't count toward the cap
  created_at timestamptz not null default now()
);
create index messages_match_idx on public.messages (match_id, created_at);

create table public.blocks (
  blocker_id uuid not null references auth.users on delete cascade,
  blocked_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references auth.users on delete cascade,
  reported_id uuid not null references auth.users on delete cascade,
  venue_id    uuid references public.venues on delete set null,
  reason      text not null check (char_length(reason) between 1 and 500),
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────

create or replace function public.is_blocked(u1 uuid, u2 uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = u1 and blocked_id = u2) or (blocker_id = u2 and blocked_id = u1)
  );
$$;

create or replace function public.has_active_post(p_user uuid, p_venue uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from venue_posts
    where user_id = p_user and venue_id = p_venue and expires_at > now()
  );
$$;

create or replace function public.is_venue_admin(p_venue uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from venue_admins where venue_id = p_venue and user_id = auth.uid());
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row level security
-- ─────────────────────────────────────────────────────────────

alter table public.venues       enable row level security;
alter table public.venue_admins enable row level security;
alter table public.profiles     enable row level security;
alter table public.venue_posts  enable row level security;
alter table public.swipes       enable row level security;  -- no policies: only via RPC
alter table public.matches      enable row level security;
alter table public.messages     enable row level security;
alter table public.blocks       enable row level security;
alter table public.reports      enable row level security;

-- Venues: anyone can read active venues; admins can update their venue
create policy "venues readable" on public.venues
  for select using (active or public.is_venue_admin(id));
create policy "venue admins update" on public.venues
  for update using (public.is_venue_admin(id)) with check (public.is_venue_admin(id));

create policy "see own admin rows" on public.venue_admins
  for select using (user_id = auth.uid());

-- Profiles: own profile full access; matched users can read each other
create policy "own profile read" on public.profiles
  for select using (id = auth.uid());
create policy "matched profile read" on public.profiles
  for select using (exists (
    select 1 from matches m
    where (m.user_a = auth.uid() and m.user_b = profiles.id)
       or (m.user_b = auth.uid() and m.user_a = profiles.id)
  ));
create policy "own profile insert" on public.profiles
  for insert with check (id = auth.uid());
create policy "own profile update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "own posts read" on public.venue_posts
  for select using (user_id = auth.uid());

create policy "own matches read" on public.matches
  for select using (auth.uid() in (user_a, user_b));

-- Messages: only participants, only while the chat is open, not if blocked
create policy "read messages in my open chats" on public.messages
  for select using (exists (
    select 1 from matches m
    where m.id = messages.match_id
      and auth.uid() in (m.user_a, m.user_b)
      and m.expires_at > now()
  ));
create policy "send messages in my open chats" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from matches m
      where m.id = messages.match_id
        and auth.uid() in (m.user_a, m.user_b)
        and m.expires_at > now()
        and not public.is_blocked(m.user_a, m.user_b)
    )
  );

create policy "own blocks read" on public.blocks
  for select using (blocker_id = auth.uid());

create policy "file reports" on public.reports
  for insert with check (reporter_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Message cap + contact-share tracking
-- ─────────────────────────────────────────────────────────────

create or replace function public.enforce_message_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m      matches%rowtype;
  cap    int;
  used   int;
begin
  -- lock the match row so concurrent sends can't exceed the cap
  select * into m from matches where id = new.match_id for update;

  if new.is_contact then
    if exists (select 1 from messages where match_id = new.match_id and sender_id = new.sender_id and is_contact) then
      raise exception 'You already shared your contact in this chat';
    end if;
    if new.sender_id = m.user_a then
      update matches set a_shared_contact = true where id = m.id;
    else
      update matches set b_shared_contact = true where id = m.id;
    end if;
    return new;
  end if;

  select message_cap into cap from venues where id = m.venue_id;
  select count(*) into used from messages where match_id = new.match_id and not is_contact;
  if used >= cap then
    raise exception 'Message limit reached for this chat';
  end if;
  return new;
end; $$;

create trigger messages_rules before insert on public.messages
for each row execute function public.enforce_message_rules();

-- ─────────────────────────────────────────────────────────────
-- RPCs
-- ─────────────────────────────────────────────────────────────

-- Publish (or re-publish) my profile at a venue
create or replace function public.publish_at_venue(p_venue uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v venues%rowtype;
  exp timestamptz;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into v from venues where id = p_venue and active;
  if not found then raise exception 'Venue not found'; end if;
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Create your profile first';
  end if;

  exp := now() + make_interval(hours => v.visibility_hours);
  update venue_posts set expires_at = now()
   where user_id = auth.uid() and venue_id = p_venue and expires_at > now();
  insert into venue_posts (venue_id, user_id, expires_at) values (p_venue, auth.uid(), exp);
  return exp;
end; $$;

-- Hide my profile at a venue right now
create or replace function public.unpublish_at_venue(p_venue uuid)
returns void language sql security definer set search_path = public as $$
  update venue_posts set expires_at = now()
   where user_id = auth.uid() and venue_id = p_venue and expires_at > now();
$$;

-- Profiles visible to me at a venue
create or replace function public.venue_feed(p_venue uuid)
returns table (
  id uuid, display_name text, bio text, photo_url text,
  intents text[], interests text[], shared_interests int, visible_until timestamptz
)
language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select p.id, p.display_name, p.bio, p.photo_url, p.intents, p.interests,
         cardinality(array(select unnest(p.interests) intersect select unnest(me.interests)))::int,
         max(vp.expires_at)
  from venue_posts vp
  join profiles p on p.id = vp.user_id
  cross join me
  where vp.venue_id = p_venue
    and vp.expires_at > now()
    and p.id <> auth.uid()
    and public.has_active_post(auth.uid(), p_venue)
    and p.intents && me.intents                         -- only compatible intents
    and not public.is_blocked(auth.uid(), p.id)
    and not exists (select 1 from swipes s where s.venue_id = p_venue and s.from_id = auth.uid() and s.to_id = p.id)
    and not exists (select 1 from matches m where m.user_a = least(auth.uid(), p.id) and m.user_b = greatest(auth.uid(), p.id) and m.venue_id = p_venue)
  group by p.id, me.interests
  order by 7 desc, max(vp.published_at) desc
  limit 100;
$$;

-- Like or pass. Returns the match id if this like completes a match.
create or replace function public.swipe(p_venue uuid, p_to uuid, p_liked boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mid uuid;
  hours int;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if not public.has_active_post(me, p_venue) or not public.has_active_post(p_to, p_venue) then
    raise exception 'Profile is no longer visible at this venue';
  end if;
  if public.is_blocked(me, p_to) then raise exception 'Not available'; end if;

  insert into swipes (venue_id, from_id, to_id, liked) values (p_venue, me, p_to, p_liked)
  on conflict (venue_id, from_id, to_id) do update set liked = excluded.liked, created_at = now();

  if p_liked and exists (
    select 1 from swipes where venue_id = p_venue and from_id = p_to and to_id = me and liked
  ) then
    select chat_hours into hours from venues where id = p_venue;
    insert into matches (venue_id, user_a, user_b, expires_at)
    values (p_venue, least(me, p_to), greatest(me, p_to), now() + make_interval(hours => hours))
    on conflict (venue_id, user_a, user_b) do nothing
    returning id into mid;
    return mid;
  end if;
  return null;
end; $$;

-- My matches with the other person's public details
create or replace function public.my_matches()
returns table (
  id uuid, venue_id uuid, venue_name text, venue_slug text, created_at timestamptz, expires_at timestamptz,
  other_id uuid, other_name text, other_photo text, other_public_key jsonb,
  i_shared boolean, they_shared boolean, messages_used int, message_cap int
)
language sql stable security definer set search_path = public as $$
  select m.id, v.id, v.name, v.slug, m.created_at, m.expires_at,
         p.id, p.display_name, p.photo_url, p.public_key,
         case when m.user_a = auth.uid() then m.a_shared_contact else m.b_shared_contact end,
         case when m.user_a = auth.uid() then m.b_shared_contact else m.a_shared_contact end,
         (select count(*)::int from messages x where x.match_id = m.id and not x.is_contact),
         v.message_cap
  from matches m
  join venues v on v.id = m.venue_id
  join profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  where auth.uid() in (m.user_a, m.user_b)
    and not public.is_blocked(m.user_a, m.user_b)
  order by m.created_at desc;
$$;

-- Block someone: hides them everywhere and closes any chat
create or replace function public.block_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_target = auth.uid() then raise exception 'Invalid'; end if;
  insert into blocks (blocker_id, blocked_id) values (auth.uid(), p_target) on conflict do nothing;
  update matches set expires_at = now()
   where user_a = least(auth.uid(), p_target) and user_b = greatest(auth.uid(), p_target);
end; $$;

-- Venue dashboard numbers (venue admins only)
create or replace function public.venue_stats(p_venue uuid, p_days int default 30)
returns table (profiles_published int, unique_people int, matches int, contacts_exchanged int, active_now int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_venue_admin(p_venue) then raise exception 'Not allowed'; end if;
  return query
  select
    (select count(*)::int from venue_posts where venue_id = p_venue and published_at > now() - make_interval(days => p_days)),
    (select count(distinct user_id)::int from venue_posts where venue_id = p_venue and published_at > now() - make_interval(days => p_days)),
    (select count(*)::int from matches where venue_id = p_venue and created_at > now() - make_interval(days => p_days)),
    (select count(*)::int from matches where venue_id = p_venue and a_shared_contact and b_shared_contact and created_at > now() - make_interval(days => p_days)),
    (select count(distinct user_id)::int from venue_posts where venue_id = p_venue and expires_at > now());
end; $$;

-- Delete my account and everything attached to it
create or replace function public.delete_me()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end; $$;

-- Remove messages of closed chats (run on a schedule, see 0002_schedule.sql)
create or replace function public.cleanup_expired()
returns void language sql security definer set search_path = public as $$
  delete from messages using matches
   where messages.match_id = matches.id and matches.expires_at < now();
$$;

-- Lock down: only expose the RPCs meant for clients
revoke execute on function public.cleanup_expired() from public, anon, authenticated;
revoke execute on function public.enforce_message_rules() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Table privileges for the Data API (explicit, so this works whether or not
-- "Grant API access to new tables automatically" is on). RLS still applies.
-- ─────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;
grant select on public.venues to anon, authenticated;
grant update (name, logo_url, visibility_hours, message_cap, chat_hours) on public.venues to authenticated;
grant select on public.venue_admins, public.venue_posts, public.matches, public.blocks to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.messages to authenticated;
grant insert on public.reports to authenticated;

grant execute on function public.is_blocked(uuid, uuid), public.is_venue_admin(uuid), public.has_active_post(uuid, uuid)
  to anon, authenticated;
grant execute on function
  public.publish_at_venue(uuid), public.unpublish_at_venue(uuid), public.venue_feed(uuid),
  public.swipe(uuid, uuid, boolean), public.my_matches(), public.block_user(uuid),
  public.venue_stats(uuid, int), public.delete_me()
  to authenticated;
revoke execute on function
  public.publish_at_venue(uuid), public.unpublish_at_venue(uuid), public.venue_feed(uuid),
  public.swipe(uuid, uuid, boolean), public.my_matches(), public.block_user(uuid),
  public.venue_stats(uuid, int), public.delete_me()
  from public, anon;

-- ─────────────────────────────────────────────────────────────
-- Realtime + storage
-- ─────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.messages;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "upload own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
