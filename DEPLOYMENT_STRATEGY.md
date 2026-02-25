# Deployment Strategy

This project uses a dual-branch deployment strategy to handle the Marketing Landing Page (`defrag.app`) and the Core Application/API (`app.defrag.app` / `/dashboard`).

## Branch Structure

*   **`landing` Branch**:
    *   **Purpose**: Serves the public-facing marketing site.
    *   **Deployment Target**: `defrag.app`.
    *   **Key File**: `app/page.tsx` (Marketing Landing Page).
    *   **User Flow**: Users land here and click "ENTER SYSTEM" to navigate to `/dashboard`.

*   **`main` Branch**:
    *   **Purpose**: Serves the core application logic, API, and authenticated user flows.
    *   **Deployment Target**: `app.defrag.app` (or `defrag.app/dashboard` if strictly monolithic).
    *   **Key File**: `app/page.tsx` (API Status Page / Redirect to Dashboard).
    *   **User Flow**: Contains the logic for `/dashboard`, `/align`, and `/api`.

## Vercel Configuration

To successfully deploy the `landing` branch to `defrag.app`, follow these steps in the Vercel Dashboard:

1.  **Project**: Go to your Vercel Project for `defrag.app`.
2.  **Settings**: Navigate to **Settings** -> **Git**.
3.  **Production Branch**:
    *   Under **Production Branch**, click **Edit**.
    *   Select **`landing`** from the dropdown menu.
    *   Click **Save**.
4.  **Deploy**:
    *   Go to the **Deployments** tab.
    *   If a deployment for `landing` hasn't started automatically, you may need to push a new commit or manually redeploy the latest commit on `landing`.

## Environment Variables

Ensure the following environment variables are set correctly for the `landing` branch deployment:

*   `NEXT_PUBLIC_API_URL`: `https://api.defrag.app` (or your backend URL)
*   `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase URL.
*   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key.

## Application Logic

*   **Landing Page**: Located at `app/page.tsx` in the `landing` branch.
*   **Dashboard**: Located at `app/dashboard/page.tsx`.
*   **API**: Located at `app/api/...`.

**Note**: The `main` branch retains the original `app/page.tsx` (Status Page). Changes to the marketing page should only be made on the `landing` branch.
