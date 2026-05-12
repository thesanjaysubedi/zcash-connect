import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { generateApiKey } from '@/lib/api-keys';
import { POST, GET } from '@/app/api/v1/invoices/route';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

let merchantId: string;
let activeFullKey: string;
const userEmail = `test-list-${Date.now()}@example.com`;

beforeAll(async () => {
  const { data: user } = await admin.auth.admin.createUser({
    email: userEmail, password: 'password123', email_confirm: true,
    user_metadata: { store_name: 'List-Test Store' },
  });
  merchantId = user.user!.id;
  await admin.from('merchants').update({
    verified: true, payout_address: 'u1' + 'a'.repeat(180),
  }).eq('id', merchantId);
  const k = await generateApiKey();
  await admin.from('api_keys').insert({
    merchant_id: merchantId, name: 'Test', prefix: k.prefix, hashed_secret: k.hashedSecret,
  });
  activeFullKey = k.fullKey;
  for (let i = 0; i < 5; i += 1) {
    await POST(new Request('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${activeFullKey}` },
      body: JSON.stringify({ amount_zec: `${i + 1}` }),
    }) as any);
    await new Promise((r) => setTimeout(r, 10));
  }
  await admin.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('merchant_id', merchantId).eq('amount_zatoshis', '300000000');
});

afterAll(async () => {
  await admin.from('invoices').delete().eq('merchant_id', merchantId);
  await admin.from('api_keys').delete().eq('merchant_id', merchantId);
  await admin.auth.admin.deleteUser(merchantId);
});

function call(qs: string) {
  return GET(new Request(`http://localhost/api/v1/invoices${qs}`, {
    headers: { authorization: `Bearer ${activeFullKey}` },
  }) as any);
}

describe('GET /api/v1/invoices (list)', () => {
  it('returns all invoices in DESC order', async () => {
    const res = await call('?limit=10');
    const body = await res.json();
    expect(body.data.length).toBe(5);
    expect(body.has_more).toBe(false);
    const amounts = body.data.map((d: any) => d.amount_zec);
    expect(amounts[0]).toBe('5');
  });

  it('paginates with the before cursor', async () => {
    const first = await call('?limit=2');
    const firstBody = await first.json();
    expect(firstBody.data.length).toBe(2);
    expect(firstBody.has_more).toBe(true);
    const second = await call(`?limit=2&before=${firstBody.next_cursor}`);
    const secondBody = await second.json();
    expect(secondBody.data.length).toBe(2);
    expect(secondBody.data[0].id).not.toBe(firstBody.data[0].id);
  });

  it('filters by status', async () => {
    const res = await call('?status=paid');
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].status).toBe('paid');
  });
});
