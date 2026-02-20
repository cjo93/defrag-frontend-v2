# DEFRAG Project Handoff Instructions

This repository contains the new `defrag-api` backend.

## 1. Backend Deployment (`defrag-api`)

1.  Deploy the `defrag-api` directory to Vercel as a new project.
2.  Set the following Environment Variables in Vercel:
    *   `NEXT_PUBLIC_SUPABASE_URL`
    *   `SUPABASE_SERVICE_ROLE_KEY`
    *   `STRIPE_SECRET_KEY`
    *   `STRIPE_WEBHOOK_SECRET`
    *   `STRIPE_PRICE_BLUEPRINT`
    *   `STRIPE_PRICE_OS`
    *   `APP_URL` (https://defrag.app)
    *   `AI_GATEWAY_URL` (https://ai-gateway.vercel.sh/v1)
    *   `OPENAI_API_KEY`
3.  Add custom domain `api.defrag.app` to the project.
4.  Configure Stripe Webhook:
    *   Endpoint: `https://api.defrag.app/api/webhook`
    *   Event: `checkout.session.completed`

## 2. Database Setup (Supabase)

1.  Go to your Supabase project SQL Editor.
2.  Run the contents of `defrag-api/supabase/migrations/0001_init.sql`.

## 3. Frontend Wiring (`defrag-web`)

In your existing frontend repository (`defrag-web` / `cjo93/v0-defrag-frontend-build`):

1.  Update Environment Variables:
    *   `NEXT_PUBLIC_SUPABASE_URL`
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    *   `NEXT_PUBLIC_API_URL=https://api.defrag.app` (CRITICAL)
    *   **REMOVE** any `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or AI keys from frontend env vars.

2.  Verify API Calls:
    Ensure your frontend code uses `process.env.NEXT_PUBLIC_API_URL` for these endpoints:
    *   `PUT /api/context`
    *   `PUT /api/baseline`
    *   `POST /api/connections`
    *   `GET /api/connections`
    *   `POST /api/checkout`
    *   `GET /api/readout/self`
    *   `GET /api/readout/[nodeId]`
    *   `POST /api/ai/chat`

3.  Deploy frontend to `defrag.app`.
