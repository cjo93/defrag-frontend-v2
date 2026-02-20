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

-- ENGINE PROVENANCE & CACHING

create table if not exists public.horizons_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete set null,
  kind text not null, -- daily_weather | baseline
  request_json jsonb not null,
  raw_text text not null,
  raw_hash text not null,
  start_utc timestamptz not null,
  stop_utc timestamptz not null,
  step_minutes int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.engine_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade,
  subject_id uuid, -- nullable, for connection friction target
  kind text not null, -- daily_weather | baseline_vector | friction
  engine_version text not null default '1.0.0',
  date_local date, -- nullable for baseline_vector
  inputs_hash text not null,
  output_json jsonb not null,
  horizons_run_id uuid references public.horizons_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Unique index for caching
create unique index if not exists idx_engine_outputs_cache
  on public.engine_outputs (user_id, kind, engine_version, inputs_hash, date_local, subject_id)
  nulls not distinct;

-- RLS
alter table public.horizons_runs enable row level security;
alter table public.engine_outputs enable row level security;

-- horizons_runs: Service role only by default (no user select)
create policy "horizons_runs_service_role" on public.horizons_runs
  for all using (false); -- Implicitly allows service_role to bypass

-- engine_outputs: User can read their own
create policy "engine_outputs_select_own" on public.engine_outputs
  for select using (auth.uid() = user_id);

-- engine_outputs: Service role writes (or user if we allowed client-side compute, but we don't)
create policy "engine_outputs_insert_service" on public.engine_outputs
  for insert with check (true); -- Service role bypasses RLS anyway, this is just explicit if needed
