-- ============================================================
-- World Cup Trip Planner — Supabase Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- Calendar entries
create table if not exists calendar_entries (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  type text not null check (type in ('travel', 'game', 'watch', 'activity', 'note')),
  title text not null,
  details jsonb default '{}',
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Accommodations (spans a date range, shown on every applicable day)
create table if not exists accommodations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  location text,
  check_in_date date not null,
  check_out_date date not null,
  link text,
  created_at timestamptz default now()
);

-- Day locations (one per day)
create table if not exists day_locations (
  date date primary key,
  location text not null,
  updated_at timestamptz default now()
);

-- Shortlist items
create table if not exists shortlist_items (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  link text,
  location text,
  tags text[] default '{}',
  date date,
  created_at timestamptz default now()
);

-- Pre-trip checklist
create table if not exists checklist_items (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  done boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS
alter table calendar_entries enable row level security;
alter table accommodations    enable row level security;
alter table day_locations     enable row level security;
alter table shortlist_items   enable row level security;
alter table checklist_items   enable row level security;

-- Policies
create policy "auth_all_calendar"       on calendar_entries for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_accommodations" on accommodations    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_locations"      on day_locations     for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_shortlist"      on shortlist_items   for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_checklist"      on checklist_items   for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- Migrations (run if tables already exist)
-- ============================================================
-- alter table shortlist_items add column if not exists tags text[] default '{}';
-- alter table shortlist_items add column if not exists date date;
-- alter table accommodations drop column if exists check_in_time;
-- alter table accommodations drop column if exists check_out_time;
-- Add 'watch' type to calendar_entries constraint:
-- alter table calendar_entries drop constraint if exists calendar_entries_type_check;
-- alter table calendar_entries add constraint calendar_entries_type_check check (type in ('travel', 'game', 'watch', 'activity', 'note'));
