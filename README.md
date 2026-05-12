# ZcashConnect

Multi-tenant SaaS that lets merchants accept shielded Zcash payments via a public REST API. Built on Next.js + Supabase.

## Local development

```bash
git clone <repo> zcashconnect
cd zcashconnect
npm install
npx supabase start
# Copy the API URL, anon key, and service_role key into .env.local
cp .env.local.example .env.local
# Apply schema
npx supabase db reset
npm run dev
```

Open http://localhost:3000. Supabase Studio: http://127.0.0.1:54323. Inbucket (email viewer): http://127.0.0.1:54324.

## Plan A scope (this milestone)

- Email+password signup + email confirmation (Supabase Auth)
- `merchants`, `api_keys`, `invoices` tables with RLS
- Dashboard: overview, settings (payout address), API keys (create/revoke)
- Manual merchant verification via SQL

To verify a merchant:

```sql
UPDATE merchants
SET verified = true, verified_at = now()
WHERE id = (SELECT id FROM auth.users WHERE email = 'foo@bar.com');
```

## What's next (Plan B)

Public REST API for invoice creation, hosted checkout page, demo store, expire-invoices cron.

## Test

```bash
npm test
```

## License

MIT.
