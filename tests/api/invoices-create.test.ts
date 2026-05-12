import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { type NextRequest } from 'next/server';
import { generateApiKey } from '@/lib/api-keys';
import { POST } from '@/app/api/v1/invoices/route';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

let merchantId: string;
let activeFullKey: string;
const userEmail = `test-create-${Date.now()}@example.com`;

async function jsonReq(headers: HeadersInit, body: unknown) {
  return new Request('http://localhost/api/v1/invoices', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeAll(async () => {
  const { data: user, error: userErr } = await admin.auth.admin.createUser({
    email: userEmail, password: 'password123', email_confirm: true,
    user_metadata: { store_name: 'Create-Test Store' },
  });
  if (userErr) throw userErr;
  merchantId = user.user!.id;
  await admin.from('merchants').update({
    verified: true, verified_at: new Date().toISOString(),
    payout_address: 'u1' + 'a'.repeat(180),
  }).eq('id', merchantId);

  const { fullKey, prefix, hashedSecret } = await generateApiKey();
  await admin.from('api_keys').insert({
    merchant_id: merchantId, name: 'Test', prefix, hashed_secret: hashedSecret,
  });
  activeFullKey = fullKey;
});

afterAll(async () => {
  await admin.from('invoices').delete().eq('merchant_id', merchantId);
  await admin.from('api_keys').delete().eq('merchant_id', merchantId);
  await admin.auth.admin.deleteUser(merchantId);
});

describe('POST /api/v1/invoices', () => {
  it('returns 401 without bearer', async () => {
    const res = await POST(await jsonReq({}, { amount_zec: '1' }));
    expect(res.status).toBe(401);
    const j = await res.json();
    expect(j.error.code).toBe('unauthorized');
  });

  it('returns 422 on bad amount', async () => {
    const res = await POST(await jsonReq(
      { authorization: `Bearer ${activeFullKey}` },
      { amount_zec: '0' },
    ));
    expect(res.status).toBe(422);
  });

  it('creates an invoice and returns the full envelope', async () => {
    const res = await POST(await jsonReq(
      { authorization: `Bearer ${activeFullKey}` },
      {
        amount_zec: '1.5',
        memo_text: 'Order #1234',
        reference: 'ord_1234',
        description: '1x T-shirt',
        expires_in: 1800,
      },
    ));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^inv_[A-Za-z0-9_-]{22}$/);
    expect(body.amount_zec).toBe('1.5');
    expect(body.amount_zatoshis).toBe(150_000_000);
    expect(body.status).toBe('open');
    expect(body.payout_address).toMatch(/^u1/);
    expect(body.checkout_url).toContain(body.id);
    expect(body.zip321_uri).toContain('zcash:u1');
    expect(body.zip321_uri).toContain('amount=1.5');
    expect(body.zip321_uri).toContain('memo=T3JkZXIgIzEyMzQ');
    expect(body.reference).toBe('ord_1234');
  });

  it('snapshots payout_address onto invoice', async () => {
    const res = await POST(await jsonReq(
      { authorization: `Bearer ${activeFullKey}` }, { amount_zec: '0.1' },
    ));
    const body = await res.json();
    await admin.from('merchants').update({ payout_address: 'u1' + 'b'.repeat(180) }).eq('id', merchantId);
    const { data: row } = await admin.from('invoices').select('payout_address').eq('id', body.id).single();
    expect(row!.payout_address.startsWith('u1aaaaa')).toBe(true);
    await admin.from('merchants').update({ payout_address: 'u1' + 'a'.repeat(180) }).eq('id', merchantId);
  });
});
