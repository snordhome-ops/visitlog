-- Run once in Supabase: SQL Editor > New query > paste > Run.

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

create table if not exists public.quotations (
  id       text primary key,            -- the quotation / invoice number
  date     date not null,
  client   text not null default '',
  sales    text not null default '',
  contact  text not null default '',
  total    numeric not null default 0,
  status   text not null default 'Open', -- Open, Won or Lost
  data     jsonb not null,               -- the full quotation (items, terms, charges)
  updated  bigint not null default 0
);
create index if not exists quotations_date_idx on public.quotations (date);

-- Lock both tables: only the server (service_role key) can read or write them.
-- No policies are added, so the public anon key gets nothing.
alter table public.visits enable row level security;
alter table public.quotations enable row level security;
