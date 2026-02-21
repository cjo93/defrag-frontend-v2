-- Phase 4: Deterministic Video Support

alter table asset_cache_private
  add column if not exists duration_ms int,
  add column if not exists fps int default 30,
  add column if not exists renderer_version text,
  add column if not exists motion_profile jsonb;

-- No changes needed to asset_cache_public (supports generic url/type).
