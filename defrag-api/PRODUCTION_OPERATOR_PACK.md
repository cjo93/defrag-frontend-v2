# DEFRAG Production Operator Pack

**Goal:** Take `defrag-api` (backend) and `defrag-web` (frontend) live at `defrag.app` with working Phase 3 flows (Engine + Rendering + Cron).

**Prerequisite:** You must have access to Vercel, Supabase, Stripe, and Cloudflare R2 dashboards.

---

## 1. Vercel Deployment (Backend & Frontend)

### Backend (`defrag-api`)
Deploy the `defrag-api` folder as a new Vercel project.

```bash
# 1. Install Vercel CLI (if needed)
npm i -g vercel

# 2. Deploy (Run inside defrag-api folder)
cd defrag-api
vercel link      # Link to existing project or create new 'defrag-api'
vercel env pull  # (Optional) Check current envs
vercel --prod    # Deploy to production
```

### Frontend (`defrag-web`)
Deploy the frontend repo.

```bash
# 1. Deploy
cd defrag-web
vercel link      # Link to 'defrag-web'
vercel --prod    # Deploy to production
```

### Domain Attachment
In Vercel Dashboard:
1.  **defrag-api:** Settings > Domains > Add `api.defrag.app`.
    *   Verify SSL Status: "Valid Configuration".
2.  **defrag-web:** Settings > Domains > Add `defrag.app` and `www.defrag.app`.
    *   Set `www.defrag.app` to redirect to `defrag.app`.
    *   Verify SSL Status: "Valid Configuration".

---

## 2. Environment Verification

Set these in Vercel **Production** Environment Variables for `defrag-api`.

**Checklist:**
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `DEFRAG_ADMIN_KEY` (Generate a strong secret: `openssl rand -hex 32`)
- [ ] `CRON_SECRET` (Vercel > Settings > Cron Jobs > "Create/Regenerate")
- [ ] `R2_ENDPOINT` (`https://<account_id>.r2.cloudflarestorage.com`)
- [ ] `R2_ACCESS_KEY_ID`
- [ ] `R2_SECRET_ACCESS_KEY`
- [ ] `R2_BUCKET`
- [ ] `R2_PUBLIC_BASE_URL`
- [ ] `STRIPE_SECRET_KEY` (Live)
- [ ] `STRIPE_WEBHOOK_SECRET` (Live)
- [ ] `AI_GATEWAY_URL`
- [ ] `OPENAI_API_KEY`

**Verification Script:**
Run this locally (with prod keys in `.env.local`) to verify visibility:
```bash
npx ts-node scripts/check-env.ts
```

---

## 3. Supabase Migration & RLS

### Apply Schema
1.  Go to Supabase Dashboard > SQL Editor.
2.  Copy contents of `defrag-api/supabase/migrations/0001_init.sql`.
3.  Run SQL.

### Verify Schema & RLS
Run this query in Supabase SQL Editor to verify tables and policies:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('horizons_runs', 'engine_outputs', 'friction_events', 'daily_frags', 'asset_cache_public', 'asset_cache_private');

-- Expected: rowsecurity = true for ALL.
```

---

## 4. Run Pipeline (Engine Validation)

Run these commands to trigger the first production batch.

### A. Compute Day (Materialize Friction & Frags)
```bash
# Replace with your actual Admin Key
export DEFRAG_ADMIN_KEY="your_secret_key"

curl -X POST https://api.defrag.app/api/v1/admin/compute-day \
  -H "x-defrag-admin-key: $DEFRAG_ADMIN_KEY"
```
**Success Output:**
```json
{ "ok": true, "usersProcessed": N, "eventsWritten": N, "fragsWritten": N, ... }
```

### B. Render Stills (Generate Assets)
```bash
curl -X POST "https://api.defrag.app/api/v1/admin/render-stills?limit=10" \
  -H "x-defrag-admin-key: $DEFRAG_ADMIN_KEY"
```
**Success Output:**
```json
{ "ok": true, "processed": N, "ready": N, "results": [...] }
```

### C. Verify Asset Public Access
Take a URL from the previous output (e.g., `https://assets.defrag.app/stills/....png`) and open in browser.
**Expect:** Valid PNG image (black background, white geometry).

---

## 5. Frontend Proof (`defrag-web`)

### Wiring
Ensure `defrag-web` has:
```
NEXT_PUBLIC_API_URL=https://api.defrag.app
```

### Smoke Test
1.  Navigate to `https://defrag.app`.
2.  Log in.
3.  Check Network Tab for request to `https://api.defrag.app/api/v1/frags/today`.
4.  **Expect:** 200 OK Response containing:
    *   `simple_text_state`
    *   `asset_url`
5.  **Verify UI:** Text renders, Image renders.

---

## 6. Stripe Proof

### Webhook
1.  Stripe Dashboard > Developers > Webhooks.
2.  Add Endpoint: `https://api.defrag.app/api/webhook`.
3.  Events: `checkout.session.completed`.
4.  Copy Signing Secret to `STRIPE_WEBHOOK_SECRET` in Vercel.

---

## 7. Cron Verification

1.  Vercel Dashboard > Settings > Cron Jobs.
2.  Verify Jobs:
    *   `/api/v1/admin/compute-day` (Daily 02:00 UTC)
    *   `/api/v1/admin/render-stills` (Every 10 mins)
3.  Verify Authorization: Vercel sends `Authorization: Bearer <CRON_SECRET>`. The API handles this automatically.
