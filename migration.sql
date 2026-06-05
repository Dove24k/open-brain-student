-- Run this ONE TIME in your Supabase SQL editor.
-- How to get there: supabase.com → your project → SQL Editor → New query → paste everything below → click Run

create table if not exists thoughts (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  created_at timestamptz default now()
);

-- Row Level Security: your data stays yours
alter table thoughts enable row level security;

create policy "allow_all" on thoughts
  for all
  to anon
  using (true)
  with check (true);
