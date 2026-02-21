# Verification Gates (Curl)

Run these to verify Production logic without UI.

## Gate 4: Engine Materialization

### 1. Compute Day (Batch)
```bash
curl -X POST https://api.defrag.app/api/v1/admin/compute-day \
  -H "x-defrag-admin-key: $DEFRAG_ADMIN_KEY"
```
**Expect:**
```json
{
  "ok": true,
  "usersProcessed": N,
  "eventsWritten": N,
  "fragsWritten": N,
  "nasaRawHash": "..."
}
```

### 2. Render Stills (Queue Processing)
```bash
curl -X POST "https://api.defrag.app/api/v1/admin/render-stills?limit=5" \
  -H "x-defrag-admin-key: $DEFRAG_ADMIN_KEY"
```
**Expect:**
```json
{
  "ok": true,
  "processed": 5,
  "ready": 5,
  "results": [{ "hash": "...", "status": "READY" }]
}
```

## Gate 5: Public Access

### 1. Check Asset
```bash
# Use hash from previous step
curl -I https://assets.defrag.app/stills/<HASH>.png
```
**Expect:** `HTTP/2 200` and `content-type: image/png`.
