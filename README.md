# ZcashConnect

Multi-tenant SaaS that lets merchants accept shielded Zcash payments via a public REST API. Built on Next.js + Supabase.

## Local development

```bash
git clone <repo> zcashconnect
cd zcashconnect
npm install
npx supabase start
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#   SUPABASE_SERVICE_ROLE_KEY from `npx supabase status` output.
# Set CRON_SECRET to any random string.
npx supabase db reset
npx tsx scripts/seed-demo-merchant.ts   # prints DEMO_API_KEY — add to .env.local
npm run dev
```

Open <http://localhost:3000>. Supabase Studio: <http://127.0.0.1:54323>. Inbucket (email viewer): <http://127.0.0.1:54324>.

## Features

- Multi-tenant merchant signup + manual verification (SQL UPDATE)
- Email + password auth via Supabase Auth (email confirmation required)
- API-key-authenticated REST API:
  - `POST /api/v1/invoices` — create an invoice (returns ZIP-321 URI + QR + hosted checkout URL)
  - `GET /api/v1/invoices/:id` — fetch one
  - `GET /api/v1/invoices` — list with cursor pagination + status filter
- Hosted checkout page at `/pay/:invoice_id` with live polled status
- Public status endpoint at `/api/public/invoices/:id/status`
- Merchant-initiated "Mark as paid" until auto-detection ships in Milestone 2
- Vercel Cron at `*/5 * * * *` expires open invoices past their TTL
- Reference demo store at `/demo` consuming the public API
- Row-level security on every merchant-owned table

## To verify a new merchant

After they sign up, open Supabase SQL editor and run:

```sql
UPDATE merchants
SET verified = true, verified_at = now()
WHERE id = (SELECT id FROM auth.users WHERE email = 'foo@bar.com');
```

## API reference

### POST /api/v1/invoices

Headers: `Authorization: Bearer <api_key>`, `Content-Type: application/json`

Request body:

```json
{ "amount_zec": "1.5", "memo_text": "Order #1234", "reference": "ord_1234",
  "description": "1x T-shirt", "expires_in": 3600 }
```

Response 201:

```json
{ "id": "inv_…", "amount_zec": "1.5", "amount_zatoshis": 150000000,
  "payout_address": "u1…", "status": "open", "expires_at": "…",
  "checkout_url": "https://…/pay/inv_…", "zip321_uri": "zcash:u1…?amount=1.5&memo=…" }
```

See [docs/superpowers/specs/2026-05-06-zcashconnect-merchant-platform-design.md](../zcash-sdk/docs/superpowers/specs/2026-05-06-zcashconnect-merchant-platform-design.md) for the full contract.

## Roadmap

- **Milestone 2:** WebZJS trial decryption → auto-status-flip → webhooks → Realtime checkout updates
- **v0.2:** `@zcashconnect/sdk` npm package
- **v0.3:** rate limiting, admin UI, custom merchant branding on checkout, USD pricing with rate-lock

## Test

```bash
npm test
```

The integration tests require `.env.local` to be sourced and local Supabase to be running.

## License

MIT.
