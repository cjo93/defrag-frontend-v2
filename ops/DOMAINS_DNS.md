# Domains & DNS

## 1. Backend API
**Domain:** `api.defrag.app`
**Project:** `defrag-api` (Vercel)

| Type | Name | Value |
| :--- | :--- | :--- |
| A | api | 76.76.21.21 |
| CNAME | api | cname.vercel-dns.com |

*(Use Vercel dashboard instructions for exact value)*

## 2. Frontend App
**Domain:** `defrag.app`
**Project:** `defrag-web` (Vercel)

| Type | Name | Value |
| :--- | :--- | :--- |
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

**Redirect:** Ensure `www.defrag.app` redirects to `defrag.app` in Vercel settings.

## 3. Asset CDN (Cloudflare R2)
**Domain:** `assets.defrag.app`
**Target:** R2 Public Bucket

| Type | Name | Value |
| :--- | :--- | :--- |
| CNAME | assets | <your-bucket>.r2.dev (or proxied via CF) |

*Ensure SSL is active on all.*
