# Frontend Integration Patch

Apply these changes to `defrag-web` to wire up Phase 3.

## 1. Env Vars
Set in Vercel Production:
```
NEXT_PUBLIC_API_URL=https://api.defrag.app
```

## 2. Frag Fetching Component
Use this pattern to fetch the daily frag + asset.

```typescript
// lib/api.ts
export async function fetchTodayFrag(token: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/frags/today`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch frag");
  return res.json();
}
```

## 3. UI Logic
```typescript
// components/DailyFrag.tsx
const { data } = useQuery(['frag'], () => fetchTodayFrag(token));

if (data.status === 'PENDING') return <Loading />; // "Calibrating..."

const { simple_text_state, simple_text_action, asset_status, asset_url } = data.frag;

return (
  <div>
    <h1>{simple_text_state}</h1>
    <h2>{simple_text_action}</h2>

    {asset_status === 'READY' ? (
      <img src={asset_url} alt="Kinematic State" />
    ) : (
      <div className="placeholder">Rendering...</div>
    )}
  </div>
);
```
