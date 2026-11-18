-- Run this once in the Supabase SQL editor (Project -> SQL editor -> New query).
-- One user (you). Row level security keeps every row private to its owner.

create extension if not exists "pgcrypto";

-- One row per device/browser that allowed notifications.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Reminders that the scheduled function sends once they are due.
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  send_at timestamptz not null,          -- stored in UTC; built from Europe/Berlin local time
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reminders_due_idx on public.reminders (send_at) where sent_at is null;

-- Every push the server sends, and when the phone reported it arrived.
create table if not exists public.push_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                    -- 'test' or 'reminder'
  title text not null,
  sent_at timestamptz not null default now(),
  received_at timestamptz                -- set by the phone via the ack-push function
);
create index if not exists push_log_user_idx on public.push_log (user_id, sent_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.reminders enable row level security;
alter table public.push_log enable row level security;

-- Subscriptions: you may read, add, update and delete your own.
create policy "own subscriptions select" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "own subscriptions insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "own subscriptions update" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subscriptions delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Reminders: you may read, add and delete your own (the server marks them sent).
create policy "own reminders select" on public.reminders
  for select using (auth.uid() = user_id);
create policy "own reminders insert" on public.reminders
  for insert with check (auth.uid() = user_id);
create policy "own reminders delete" on public.reminders
  for delete using (auth.uid() = user_id);

-- Push log: read-only for you; only the server (service role) writes it.
create policy "own push log select" on public.push_log
  for select using (auth.uid() = user_id);
