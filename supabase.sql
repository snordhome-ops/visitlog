-- Run this once in Supabase: SQL Editor > New query > paste > Run.
create table if not exists public.visits (
  id          text primary key,
  date        date not null,
  client      text not null,
  phone       text not null default '',
  location    text not null default '',
  reference   text not null default '',
  architect   text not null default '',
  dealer      text not null default '',
  salesperson text not null default '',
  status      text not null default 'Visit only',
  interest    text not null default '',
  remarks     text not null default '',
  created     bigint not null default 0
);
create index if not exists visits_date_idx on public.visits (date);

-- Lock the table: only the server (service_role key) can read or write it.
-- No policies are added, so the public anon key gets nothing.
alter table public.visits enable row level security;
