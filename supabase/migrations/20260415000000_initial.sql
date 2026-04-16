-- Revelo: multiplayer deduction game schema
-- Run in Supabase SQL editor or via supabase db push

create extension if not exists pgcrypto;

-- Types
create type room_status as enum ('waiting', 'playing', 'finished');
create type shape_type as enum ('circle', 'square', 'triangle');
create type color_type as enum ('red', 'blue', 'green');

-- Users (linked to Supabase Auth)
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Rooms (current_turn FK added after players exist)
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status room_status not null default 'waiting',
  host_user_id uuid not null references public.users (id) on delete restrict,
  current_turn_player_id uuid,
  created_at timestamptz not null default now()
);

-- Players
create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  errors int not null default 0 check (errors >= 0 and errors <= 2),
  is_alive boolean not null default true,
  turn_order int not null default 0,
  unique (room_id, user_id)
);

alter table public.rooms
  add constraint rooms_current_turn_fk
  foreign key (current_turn_player_id) references public.players (id) on delete set null;

create index players_room_idx on public.players (room_id);
create index players_user_idx on public.players (user_id);

-- Combinations (secret — RLS restricts to owner)
create table public.combinations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  shape shape_type not null,
  color color_type not null,
  unique (player_id)
);

create index combinations_player_idx on public.combinations (player_id);

-- Global knowledge about each player's secret (visible to everyone in room)
create table public.revelations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  shape_known boolean not null default false,
  color_known boolean not null default false,
  shape shape_type,
  color color_type,
  unique (room_id, player_id)
);

create index revelations_room_idx on public.revelations (room_id);

-- Guesses
create table public.guesses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  attacker_id uuid not null references public.players (id) on delete cascade,
  target_id uuid not null references public.players (id) on delete cascade,
  shape shape_type not null,
  color color_type not null,
  correct boolean not null,
  shape_match boolean not null,
  color_match boolean not null,
  created_at timestamptz not null default now()
);

create index guesses_room_idx on public.guesses (room_id, created_at desc);

-- ---------- Row Level Security ----------
alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.combinations enable row level security;
alter table public.revelations enable row level security;
alter table public.guesses enable row level security;

create policy users_select_own on public.users for select using (id = auth.uid());
create policy users_insert_own on public.users for insert with check (id = auth.uid());
create policy users_update_own on public.users for update using (id = auth.uid());

create policy rooms_select_member on public.rooms for select using (
  exists (select 1 from public.players p where p.room_id = rooms.id and p.user_id = auth.uid())
);

create policy players_select_same_room on public.players for select using (
  exists (
    select 1 from public.players me
    where me.room_id = players.room_id and me.user_id = auth.uid()
  )
);

create policy combinations_select_own on public.combinations for select using (
  exists (
    select 1 from public.players p
    where p.id = combinations.player_id and p.user_id = auth.uid()
  )
);

create policy revelations_select_room on public.revelations for select using (
  exists (select 1 from public.players p where p.room_id = revelations.room_id and p.user_id = auth.uid())
);

create policy guesses_select_room on public.guesses for select using (
  exists (select 1 from public.players p where p.room_id = guesses.room_id and p.user_id = auth.uid())
);

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.revelations;
alter publication supabase_realtime add table public.guesses;
alter publication supabase_realtime add table public.rooms;
