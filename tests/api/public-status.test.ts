import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { generateApiKey } from '@/lib/api-keys';
import { POST } from '@/app/api/v1/invoices/route';
import { GET as STATUS } from '@/app/api/public/invoices/[id]/status/route';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

let merchantId: string;
let invoiceId: string;

beforeAll(async () => {
  const { data: user } = await admin.auth.admin.createUser({
    email: `test-status-${Date.now()}@example.com`, password: 'password123', email_confirm: true,
    user_metadata: { store_name: 'Status-Test Store' },
  });
  merchantId = user.user!.id;
  await admin.from('merchants').update({
    verified: true, payout_address: 'u1' + 'a'.repeat(180),
  }).eq('id', merchantId);
  const k = await generateApiKey();
  await admin.from('api_keys').insert({
    merchant_id: merchantId, name: 'Test', prefix: k.prefix, hashed_secret: k.hashedSecret,
  });
  const r = await POST(new Request('http://localhost/api/v1/invoices', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${k.fullKey}` },
    body: JSON.stringify({ amount_zec: '0.25' }),
  }) as any);
  invoiceId = (await r.json()).id;
});

afterAll(async () => {
  await admin.from('invoices').delete().eq('merchant_id', merchantId);
  await admin.from('api_keys').delete().eq('merchant_id', merchantId);
  await admin.auth.admin.deleteUser(merchantId);
});

function call(id: string) {
  return STATUS(new Request(`http://localhost/api/public/invoices/${id}/status`),
    { params: Promise.resolve({ id }) });
}

describe('GET /api/public/invoices/[id]/status', () => {
  it('returns minimal status fields without auth', async () => {
    const res = await call(invoiceId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('open');
    expect(body.paid_at).toBeNull();
    expect(typeof body.expires_at).toBe('string');
    expect(body.amount_zec).toBeUndefined();
    expect(body.payout_address).toBeUndefined();
  });

  it('returns 404 for an unknown id', async () => {
    const res = await call('inv_doesnotexist123456789012');
    expect(res.status).toBe(404);
  });
});
