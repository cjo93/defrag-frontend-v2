# PHASE 4 — Deterministic Video Generator Pipeline

**Objective:** Complete the Kinematic Sandbox promise by providing deterministic, scrubbable video assets (.mp4) derived from Friction Events.

## 1. Core Principles
*   **Determinism:** video_hash = sha256(inputs + version). Identical inputs always produce identical pixels.
*   **Stateless:** API triggers rendering; does not maintain session state.
*   **Secure:** Reconstruction parameters live in asset_cache_private (Service Role only). Public clients see only R2 URLs.
*   **Zero-Theatre:** No random effects. Motion is a function of friction_score, pressure_score, and deterministic seed.

## 2. Rendering Strategy: Remotion Lambda
*   **Stack:** Remotion (React-based video) running on AWS Lambda.
*   **Output:** H.264 MP4, 30fps, ~6-10 seconds.
*   **Versioning:** RENDERER_VERSION = "v1-video". Bumping version invalidates cache.

## 3. Schema Extensions

### asset_cache_private
Add columns to support motion reconstruction:
```sql
alter table asset_cache_private
add column if not exists duration_ms int,
add column if not exists fps int default 30,
add column if not exists renderer_version text,
add column if not exists motion_profile jsonb; -- curves, collision intensity
```

### asset_cache_public
Existing schema supports video via:
*   type = 'VIDEO'
*   url points to .mp4
*   duration_seconds populated.

## 4. Admin Route Contract

### POST /api/v1/admin/render-video
**Auth:** x-defrag-admin-key OR Authorization: Bearer <CRON_SECRET>

**Body:**
```json
{
  "friction_id": "uuid",
  "duration_ms": 6000,
  "force_regenerate": false
}
```

**Pipeline:**
1.  **Fetch Context:** Load friction_events row (scores, provenance).
2.  **Derive Inputs:**
    *   seed = event.provenance_hash
    *   motion_profile = deriveMotion(scores, seed)
3.  **Compute Hash:** video_hash = sha256(canonical_inputs + RENDERER_VERSION)
4.  **Cache Check:**
    *   If asset_cache_public has READY row for video_hash, return URL.
5.  **Render (On Miss):**
    *   Trigger Remotion Lambda.
    *   Upload result to R2 (videos/{version}/{hash}.mp4).
6.  **Store:**
    *   Upsert asset_cache_public (READY, URL).
    *   Upsert asset_cache_private (params, motion_profile).
7.  **Return:**
    *   { url: "...", status: "READY" | "QUEUED" }

## 5. Rendering Model
*   **Continuum:** Video represents the full slider range (0% to 100%).
*   **Scrubbing:** Frontend maps slider position to video time: currentTime = sliderVal * duration.
*   **Composition:**
    *   **Frame 0:** High Tension / Fail State.
    *   **Midpoint:** Awareness / Alignment.
    *   **End:** Resolved / Boundary Stable.

## 6. Security & Observability
*   **Logs:** Log render_duration_ms, cache_hit. NEVER log motion_profile contents.
*   **Storage:** R2 Bucket. Public read-only.
*   **Access:** Client accesses via signed URL or public bucket URL (if public).
