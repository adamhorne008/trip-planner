-- ============================================================
-- The Ridings — Supabase Schema
-- Run in Supabase SQL editor (fresh database)
-- ============================================================

-- Roadmap tasks (create first — todos FK references this)
create table if not exists roadmap_tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  owner text not null default 'Both' check (owner in ('Adam','Kayleigh','Both')),
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','completed','blocked')),
  start_date date not null,
  end_date date not null,
  notes text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Calendar entries
create table if not exists calendar_entries (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  title text not null,
  notes text,
  created_by text not null default 'Adam' check (created_by in ('Adam','Kayleigh')),
  created_at timestamptz default now()
);

-- Todos
create table if not exists todos (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  assigned_to text not null default 'Both' check (assigned_to in ('Adam','Kayleigh','Both')),
  due_date date,
  completed boolean default false,
  task_id uuid references roadmap_tasks(id) on delete set null,
  created_at timestamptz default now()
);

-- RLS
alter table roadmap_tasks    enable row level security;
alter table calendar_entries enable row level security;
alter table todos             enable row level security;

create policy "auth_all_roadmap"   on roadmap_tasks    for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
create policy "auth_all_calendar"  on calendar_entries for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
create policy "auth_all_todos"     on todos            for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
