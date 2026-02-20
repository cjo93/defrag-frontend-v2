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

-- =========
-- Helpers
-- =========
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ======================
-- pinned_connections
-- ======================
create table if not exists pinned_connections (
  user_id uuid not null references profiles(user_id) on delete cascade,
  connection_id uuid not null references connections(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (user_id, connection_id)
);
alter table pinned_connections enable row level security;

create policy "pinned_select_own" on pinned_connections
  for select using (auth.uid() = user_id);

create policy "pinned_write_own" on pinned_connections
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from connections c
      where c.id = connection_id and c.user_id = auth.uid()
    )
  );

create policy "pinned_delete_own" on pinned_connections
  for delete using (auth.uid() = user_id);

-- ======================
-- friction_events
-- ======================
create table if not exists friction_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(user_id) on delete cascade,
  connection_id uuid not null references connections(id) on delete cascade,
  event_date date not null,
  engine_version text not null,
  pressure_score int not null check (pressure_score between 0 and 100),
  friction_score int not null check (friction_score between 0 and 100),
  friction_delta int, -- signed: today - yesterday
  primary_gate text not null default 'NONE',
  fidelity_bucket text not null check (fidelity_bucket in ('HIGH','MEDIUM','LOW')),
  asset_hash text not null,
  provenance_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, connection_id, event_date, engine_version)
);
create index if not exists friction_events_user_date_idx on friction_events(user_id, event_date);
alter table friction_events enable row level security;

create policy "friction_select_own" on friction_events
  for select using (auth.uid() = user_id);

create trigger trg_set_updated_at_friction_events
before update on friction_events
for each row execute function set_updated_at();

-- ======================
-- daily_frags
-- ======================
create table if not exists daily_frags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(user_id) on delete cascade,
  local_date date not null,
  engine_version text not null,
  top_event_id uuid references friction_events(id) on delete set null,
  simple_text_state text not null,
  simple_text_action text not null,
  asset_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date, engine_version)
);
create index if not exists daily_frags_user_date_idx on daily_frags(user_id, local_date);
alter table daily_frags enable row level security;

create policy "daily_frags_select_own" on daily_frags
  for select using (auth.uid() = user_id);

create trigger trg_set_updated_at_daily_frags
before update on daily_frags
for each row execute function set_updated_at();

-- ======================
-- asset_cache_public (delivery only; safe to expose)
-- ======================
create table if not exists asset_cache_public (
  hash text primary key,
  type text not null check (type in ('STILL','VIDEO')),
  status text not null check (status in ('MISSING','QUEUED','READY','FAILED')),
  url text,
  width int,
  height int,
  duration_seconds int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table asset_cache_public enable row level security;

create policy "asset_cache_public_read_auth" on asset_cache_public
  for select using (auth.role() = 'authenticated');

create trigger trg_set_updated_at_asset_cache_public
before update on asset_cache_public
for each row execute function set_updated_at();

-- ======================
-- asset_cache_private (service-role only; reconstruction fields)
-- ======================
create table if not exists asset_cache_private (
  hash text primary key references asset_cache_public(hash) on delete cascade,
  canonical text not null,
  user_class text not null,
  target_class text not null,
  pressure_bucket text not null check (pressure_bucket in ('LOW','MED','HIGH')),
  fidelity_bucket text not null check (fidelity_bucket in ('HIGH','MEDIUM','LOW')),
  friction_bracket10 int not null check (friction_bracket10 in (0,10,20,30,40,50,60,70,80,90,100)),
  asset_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table asset_cache_private enable row level security;

-- IMPORTANT: no SELECT policies. Service role only.
create trigger trg_set_updated_at_asset_cache_private
before update on asset_cache_private
for each row execute function set_updated_at();
