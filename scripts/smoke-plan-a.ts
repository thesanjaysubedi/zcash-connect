import { createClient } from '@supabase/supabase-js';
import { generateApiKey, parseApiKey, verifyApiKey } from '../lib/api-keys';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key, { auth: { persistSession: false } });

  console.log('== Smoke test: Plan A end-to-end ==');

  // 1. Create a user via auth admin API (simulates signup + email-confirm)
  const email = `smoke-${Date.now()}@example.com`;
  console.log(`Creating user ${email}...`);
  const { data: user, error: ue } = await admin.auth.admin.createUser({
    email, password: 'password123', email_confirm: true,
    user_metadata: { store_name: 'Smoke Store' },
  });
  if (ue) throw new Error(`createUser: ${ue.message}`);
  const merchantId = user.user!.id;

  // 2. Verify the trigger created the merchants row
  const { data: m1 } = await admin.from('merchants').select('*').eq('id', merchantId).single();
  if (!m1) throw new Error('trigger did not create merchants row');
  if (m1.verified) throw new Error('new merchant should be unverified');
  console.log('OK: handle_new_user trigger fired; row is unverified.');

  // 3. Manually verify (simulates the operator's SQL UPDATE)
  await admin.from('merchants').update({
    verified: true, verified_at: new Date().toISOString(),
    payout_address: 'u1' + 'a'.repeat(180),
  }).eq('id', merchantId);
  const { data: m2 } = await admin.from('merchants').select('verified, payout_address').eq('id', merchantId).single();
  if (!m2!.verified || !m2!.payout_address) throw new Error('verify update did not stick');
  console.log('OK: merchant verified + payout address set.');

  // 4. Create an API key — exercise the same path the dashboard server action uses
  const { fullKey, prefix, hashedSecret } = await generateApiKey();
  const { error: insertErr } = await admin.from('api_keys').insert({
    merchant_id: merchantId, name: 'Smoke Key', prefix, hashed_secret: hashedSecret,
  });
  if (insertErr) throw new Error(`api_keys insert: ${insertErr.message}`);
  console.log(`OK: API key created. Full key: ${fullKey.slice(0, 24)}…`);

  // 5. Round-trip verify the key (simulates API auth)
  const parsed = parseApiKey(fullKey);
  if (!parsed) throw new Error('parseApiKey returned null on our own key');
  const ok = await verifyApiKey(parsed.secret, hashedSecret);
  if (!ok) throw new Error('verifyApiKey rejected own key');
  console.log('OK: parseApiKey + verifyApiKey round-trip succeeded.');

  // 6. Revoke
  const { data: keyRows } = await admin.from('api_keys').select('id').eq('merchant_id', merchantId);
  await admin.from('api_keys').update({ revoked_at: new Date().toISOString() })
    .eq('id', keyRows![0].id);
  const { data: revoked } = await admin.from('api_keys').select('revoked_at').eq('id', keyRows![0].id).single();
  if (!revoked!.revoked_at) throw new Error('revoke did not stick');
  console.log('OK: revoke succeeded.');

  // 7. Clean up — cascade delete
  await admin.auth.admin.deleteUser(merchantId);
  const { data: gone } = await admin.from('merchants').select('id').eq('id', merchantId);
  if (gone && gone.length > 0) throw new Error('cascade delete failed');
  console.log('OK: cleanup cascade succeeded.');

  console.log('\n== SMOKE PASSED ==');
}

main().catch((e) => { console.error('SMOKE FAILED:', e.message); process.exit(1); });
