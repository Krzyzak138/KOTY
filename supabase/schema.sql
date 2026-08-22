create table if not exists public.feedings (
  id text primary key,
  cat text not null check (cat in ('Angela', 'Basta')),
  meal text not null check (meal in ('morning', 'snack', 'evening')),
  fed_at timestamptz not null default now(),
  fed_by text not null check (fed_by in ('Marek', 'Karolina', 'Albert', 'Laura')),
  local_date date not null,
  batch_id text
);

create index if not exists feedings_local_date_idx
  on public.feedings (local_date desc, fed_at desc);

alter table public.feedings enable row level security;

grant select, insert on public.feedings to anon;

create policy "family can read feedings"
  on public.feedings for select to anon using (true);

create policy "family can add feedings"
  on public.feedings for insert to anon with check (true);

alter publication supabase_realtime add table public.feedings;

create table if not exists public.care_events (
  id text primary key,
  activity text not null check (activity in ('play', 'brushing', 'litter')),
  cat text check (cat in ('Angela', 'Basta')),
  done_at timestamptz not null default now(),
  done_by text not null check (done_by in ('Marek', 'Karolina', 'Albert', 'Laura')),
  local_date date not null,
  check (
    (activity = 'litter' and cat is null)
    or (activity in ('play', 'brushing') and cat is not null)
  )
);

create index if not exists care_events_local_date_idx
  on public.care_events (local_date desc, done_at desc);

alter table public.care_events enable row level security;

grant select, insert on public.care_events to anon;

create policy "family can read care events"
  on public.care_events for select to anon using (true);

create policy "family can add care events"
  on public.care_events for insert to anon with check (true);

alter publication supabase_realtime add table public.care_events;
