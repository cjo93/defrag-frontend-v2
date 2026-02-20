-- Profiles (subscription truth)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  subscription_status text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_context (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  city text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade,
  dob date not null,
  birth_time time,
  birth_city text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade,
  name text not null,
  relationship_type text not null,
  dob date not null,
  birth_time time,
  birth_city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_context enable row level security;
alter table public.baselines enable row level security;
alter table public.connections enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = user_id);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = user_id);

-- user_context
create policy "context_select_own" on public.user_context
for select using (auth.uid() = user_id);

create policy "context_upsert_own" on public.user_context
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- baselines
create policy "baselines_select_own" on public.baselines
for select using (auth.uid() = user_id);

create policy "baselines_write_own" on public.baselines
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- connections
create policy "connections_select_own" on public.connections
for select using (auth.uid() = user_id);

create policy "connections_write_own" on public.connections
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- conversations
create policy "conversations_select_own" on public.conversations
for select using (auth.uid() = user_id);

create policy "conversations_write_own" on public.conversations
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- messages: join to conversations for ownership
create policy "messages_select_own" on public.messages
for select using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
);

create policy "messages_write_own" on public.messages
for insert with check (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
);
