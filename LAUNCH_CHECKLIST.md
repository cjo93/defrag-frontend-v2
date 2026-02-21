# DEFRAG Production Launch Checklist

Follow this guide to move from Handoff to Live Production.

## PHASE A — Production Deployment Verification

### 1. Backend Project (defrag-api)
- [ ] Deploy `defrag-api` to Vercel (Production).
- [ ] Configure Environment Variables in Vercel:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `DEFRAG_ADMIN_KEY` (Generate a strong secret)
  - `CRON_SECRET` (Vercel Cron protection)
  - `R2_ENDPOINT`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET`
  - `R2_PUBLIC_BASE_URL`
  - `STRIPE_SECRET_KEY` (Live Mode)
  - `STRIPE_WEBHOOK_SECRET` (Live Mode)

### 2. Domain Attachment
- [ ] Attach `api.defrag.app` to `defrag-api` project.
- [ ] Attach `defrag.app` to frontend project.
- [ ] Verify SSL is valid for both.

### 3. Supabase Migration
- [ ] Run `supabase/migrations/0001_init.sql` in Production Supabase SQL Editor.
- [ ] Verify Tables exist:
  - `horizons_runs`, `engine_outputs`, `friction_events`, `daily_frags`
  - `asset_cache_public`, `asset_cache_private`
- [ ] Verify RLS Policies:
  - `asset_cache_private` must NOT have public read policies.
  - `horizons_runs` must NOT have public read policies.

## PHASE B — Engine Validation

### 1. Compute Day
- [ ] Trigger: `POST https://api.defrag.app/api/v1/admin/compute-day`
  - Header: `x-defrag-admin-key: <YOUR_KEY>`
- [ ] Verify:
  - Response is 200 OK.
  - `horizons_runs` has a new row for today.
  - `asset_cache_public` has rows with status 'MISSING'.

### 2. Render Stills
- [ ] Trigger: `POST https://api.defrag.app/api/v1/admin/render-stills?limit=5`
  - Header: `x-defrag-admin-key: <YOUR_KEY>`
- [ ] Verify:
  - Response includes rendered items.
  - `asset_cache_public` rows update to 'READY' with URLs.
  - URLs load the PNG image from R2.

## PHASE C — Frontend Wiring

### 1. Env Vars
- [ ] Frontend Vercel Project: Set `NEXT_PUBLIC_API_URL=https://api.defrag.app`.

### 2. Full Flow
- [ ] Login to `defrag.app`.
- [ ] Navigate to `/frag` (or equivalent).
- [ ] Confirm daily text and asset load correctly.
- [ ] Check console for 401s or CORS errors.

## PHASE D — Stripe
- [ ] Configure Stripe Webhook to `https://api.defrag.app/api/webhook`.
- [ ] Test a live (or test-mode) purchase.
- [ ] Verify `profiles.subscription_status` updates.

## PHASE E — Cron
- [ ] Check Vercel Project > Settings > Cron Jobs.
- [ ] Verify `/api/v1/admin/compute-day` scheduled for 02:00 UTC.
- [ ] Verify `/api/v1/admin/render-stills` scheduled for 10 min intervals.

## PHASE F — Visual Quality
- [ ] Verify pure black backgrounds.
- [ ] Check typography on mobile.
- [ ] Verify PWA manifest installability.

---
**Status Reporting:**
Once checked, report:
1. Confirmation of A-F.
2. Exact URLs tested.
3. Any blockers.
