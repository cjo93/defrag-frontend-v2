-- Add status and invite fields to connections
alter table public.connections
add column if not exists status text not null default 'active' check (status in ('active', 'pending')),
add column if not exists invite_token uuid default gen_random_uuid(),
add column if not exists invite_email text,
alter column dob drop not null,
alter column birth_city drop not null;

create unique index if not exists connections_invite_token_unique on public.connections(invite_token);
