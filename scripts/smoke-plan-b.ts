import { createClient } from '@supabase/supabase-js';

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const demoKey = process.env.DEMO_API_KEY;
  if (!demoKey) throw new Error('Set DEMO_API_KEY in .env.local (run scripts/seed-demo-merchant.ts first)');

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  console.log('== Plan B end-to-end smoke test ==');
  console.log(`Base URL: ${baseUrl}`);

  // 1. Demo store checkout: POST form, expect 303 redirect
  console.log('\n[1] /demo/checkout (form POST)');
  const form = new URLSearchParams({ product_id: 'tshirt' });
  const checkoutRes = await fetch(`${baseUrl}/demo/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    redirect: 'manual',
  });
  if (checkoutRes.status !== 303 && checkoutRes.status !== 307) {
    const txt = await checkoutRes.text();
    throw new Error(`/demo/checkout returned ${checkoutRes.status}: ${txt}`);
  }
  const checkoutUrl = checkoutRes.headers.get('location');
  if (!checkoutUrl) throw new Error('No Location header on redirect');
  const invoiceId = checkoutUrl.split('/').pop()!;
  console.log(`OK: Got checkout URL ${checkoutUrl}`);
  console.log(`OK: Invoice id ${invoiceId}`);

  // 2. Hit hosted checkout page — expect 200 and "Pay" content
  console.log('\n[2] GET /pay/[id]');
  const payRes = await fetch(`${baseUrl}/pay/${invoiceId}`);
  if (payRes.status !== 200) throw new Error(`/pay returned ${payRes.status}`);
  const payHtmlRaw = await payRes.text();
  // Next.js SSR inserts <!-- --> comment nodes between adjacent JSX text — strip them before matching
  const payHtml = payHtmlRaw.replace(/<!--.*?-->/g, '');
  if (!payHtml.includes('Demo Shop')) throw new Error('Checkout page missing store name');
  if (!payHtml.includes('Pay 0.25 ZEC')) throw new Error('Checkout page missing amount');
  console.log('OK: Checkout page renders correctly.');

  // 3. Hit public status — expect open
  console.log('\n[3] GET /api/public/invoices/[id]/status');
  let statusRes = await fetch(`${baseUrl}/api/public/invoices/${invoiceId}/status`);
  let statusBody = await statusRes.json();
  if (statusBody.status !== 'open') throw new Error(`Expected open, got ${statusBody.status}`);
  if (statusBody.amount_zec !== undefined) throw new Error('Public status leaks amount_zec');
  if (statusBody.payout_address !== undefined) throw new Error('Public status leaks payout_address');
  console.log('OK: Public status returns minimal fields, no PII.');

  // 4. Mark as paid via admin (simulating merchant click)
  console.log('\n[4] Admin: mark invoice as paid');
  const { error: updErr } = await admin.from('invoices').update({
    status: 'paid', paid_at: new Date().toISOString(), paid_txid: 'abc123testtxid',
  }).eq('id', invoiceId);
  if (updErr) throw updErr;

  // 5. Public status reflects the flip
  console.log('\n[5] GET status again — expect paid');
  statusRes = await fetch(`${baseUrl}/api/public/invoices/${invoiceId}/status`);
  statusBody = await statusRes.json();
  if (statusBody.status !== 'paid') throw new Error(`Expected paid, got ${statusBody.status}`);
  if (!statusBody.paid_at) throw new Error('paid_at is null');
  console.log('OK: Status flipped to paid.');

  // 6. Cron expiry: create an already-expired invoice, hit cron, verify it flips
  console.log('\n[6] Cron expiry');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error('Set CRON_SECRET in .env.local');

  // Create another invoice via demo store
  const checkoutRes2 = await fetch(`${baseUrl}/demo/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ product_id: 'mug' }).toString(),
    redirect: 'manual',
  });
  const expiredInvoiceId = checkoutRes2.headers.get('location')!.split('/').pop()!;

  // Force it expired in the DB
  await admin.from('invoices').update({
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  }).eq('id', expiredInvoiceId);

  // Hit the cron
  const cronRes = await fetch(`${baseUrl}/api/cron/expire-invoices`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  const cronBody = await cronRes.json();
  if (cronBody.expired < 1) throw new Error(`Cron expired 0 invoices, expected >=1`);
  console.log(`OK: Cron expired ${cronBody.expired} invoice(s).`);

  const statusRes3 = await fetch(`${baseUrl}/api/public/invoices/${expiredInvoiceId}/status`);
  const statusBody3 = await statusRes3.json();
  if (statusBody3.status !== 'expired') throw new Error(`Expected expired, got ${statusBody3.status}`);
  console.log('OK: Expired invoice shows expired status.');

  // 7. Reject without auth on /api/v1/invoices
  console.log('\n[7] /api/v1/invoices without auth');
  const noAuthRes = await fetch(`${baseUrl}/api/v1/invoices`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount_zec: '1' }),
  });
  if (noAuthRes.status !== 401) throw new Error(`Expected 401, got ${noAuthRes.status}`);
  console.log('OK: Unauthenticated POST rejected with 401.');

  // 8. Reject host allow-list violation (not in scope of any test; just confirm)
  // (omitted — covered by unit tests)

  // Cleanup test invoices created
  await admin.from('invoices').delete().in('id', [invoiceId, expiredInvoiceId]);

  console.log('\n== PLAN B SMOKE PASSED ==');
}

main().catch((e) => { console.error('SMOKE FAILED:', e.message); process.exit(1); });
