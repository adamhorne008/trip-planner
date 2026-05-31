-- ============================================================
-- World Cup Trip Planner — Supabase Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- Calendar entries (travel, game, activity, accommodation, note)
create table if not exists calendar_entries (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  type text not null check (type in ('travel', 'game', 'activity', 'accommodation', 'note')),
  title text not null,
  details jsonb default '{}',
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Shortlist items
create table if not exists shortlist_items (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  link text,
  location text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table calendar_entries enable row level security;
alter table shortlist_items enable row level security;

-- Allow any authenticated user full access (single-user app)
create policy "auth_all_calendar" on calendar_entries
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth_all_shortlist" on shortlist_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
