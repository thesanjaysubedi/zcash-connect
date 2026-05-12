import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { generateApiKey } from '@/lib/api-keys';
import { POST } from '@/app/api/v1/invoices/route';
import { GET } from '@/app/api/v1/invoices/[id]/route';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

let merchantId: string;
let activeFullKey: string;
let invoiceId: string;
const userEmail = `test-get-${Date.now()}@example.com`;

beforeAll(async () => {
  const { data: user } = await admin.auth.admin.createUser({
    email: userEmail, password: 'password123', email_confirm: true,
    user_metadata: { store_name: 'Get-Test Store' },
  });
  merchantId = user.user!.id;
  await admin.from('merchants').update({
    verified: true, verified_at: new Date().toISOString(),
    payout_address: 'u1' + 'a'.repeat(180),
  }).eq('id', merchantId);
  const k = await generateApiKey();
  await admin.from('api_keys').insert({
    merchant_id: merchantId, name: 'Test', prefix: k.prefix, hashed_secret: k.hashedSecret,
  });
  activeFullKey = k.fullKey;
  const createRes = await POST(new Request('http://localhost/api/v1/invoices', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${activeFullKey}` },
    body: JSON.stringify({ amount_zec: '0.5', memo_text: 'M' }),
  }) as any);
  invoiceId = (await createRes.json()).id;
});

afterAll(async () => {
  await admin.from('invoices').delete().eq('merchant_id', merchantId);
  await admin.from('api_keys').delete().eq('merchant_id', merchantId);
  await admin.auth.admin.deleteUser(merchantId);
});

describe('GET /api/v1/invoices/[id]', () => {
  function call(headers: HeadersInit, id: string) {
    return GET(new Request(`http://localhost/api/v1/invoices/${id}`, { headers }) as any,
      { params: Promise.resolve({ id }) });
  }

  it('401 without auth', async () => {
    const res = await call({}, invoiceId);
    expect(res.status).toBe(401);
  });

  it('returns the invoice for its owner', async () => {
    const res = await call({ authorization: `Bearer ${activeFullKey}` }, invoiceId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(invoiceId);
    expect(body.amount_zec).toBe('0.5');
  });

  it('404 for unknown id', async () => {
    const res = await call({ authorization: `Bearer ${activeFullKey}` }, 'inv_doesnotexist123456789012');
    expect(res.status).toBe(404);
  });

  it("404 for another merchant's invoice", async () => {
    const { data: otherUser } = await admin.auth.admin.createUser({
      email: `other-${Date.now()}@example.com`, password: 'password123', email_confirm: true,
      user_metadata: { store_name: 'Other' },
    });
    const otherId = otherUser.user!.id;
    await admin.from('merchants').update({
      verified: true, payout_address: 'u1' + 'b'.repeat(180),
    }).eq('id', otherId);
    const ok = await generateApiKey();
    await admin.from('api_keys').insert({
      merchant_id: otherId, name: 'O', prefix: ok.prefix, hashed_secret: ok.hashedSecret,
    });
    const r = await POST(new Request('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ok.fullKey}` },
      body: JSON.stringify({ amount_zec: '1' }),
    }) as any);
    const otherInvoiceId = (await r.json()).id;

    const res = await call({ authorization: `Bearer ${activeFullKey}` }, otherInvoiceId);
    expect(res.status).toBe(404);

    await admin.from('invoices').delete().eq('merchant_id', otherId);
    await admin.from('api_keys').delete().eq('merchant_id', otherId);
    await admin.auth.admin.deleteUser(otherId);
  });
});
