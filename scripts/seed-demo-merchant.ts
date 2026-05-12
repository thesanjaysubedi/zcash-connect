import { createClient } from '@supabase/supabase-js';
import { generateApiKey } from '../lib/api-keys';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
  const DEMO_EMAIL = 'demo@zcashconnect.local';
  const DEMO_PAYOUT = process.env.DEMO_PAYOUT_ADDRESS
    ?? 'u1' + 'a'.repeat(180);

  await supabase.auth.admin.deleteUser(DEMO_USER_ID).catch(() => {});
  const { data: user, error: userErr } = await supabase.auth.admin.createUser({
    id: DEMO_USER_ID, email: DEMO_EMAIL, password: 'demo-password-123',
    email_confirm: true, user_metadata: { store_name: 'Demo Shop (ZcashConnect)' },
  });
  if (userErr) throw userErr;

  await supabase.from('merchants').update({
    verified: true, verified_at: new Date().toISOString(),
    payout_address: DEMO_PAYOUT,
  }).eq('id', user.user!.id);

  const { fullKey, prefix, hashedSecret } = await generateApiKey();
  await supabase.from('api_keys').insert({
    merchant_id: user.user!.id, name: 'Demo Store Key', prefix, hashed_secret: hashedSecret,
  });

  console.log('-- Add this to .env.local: --');
  console.log(`DEMO_API_KEY=${fullKey}`);
  console.log('-- (rotate by re-running this script) --');
}

main().catch((e) => { console.error(e); process.exit(1); });
