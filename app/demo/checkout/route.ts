import { NextResponse, type NextRequest } from 'next/server';
import { findProduct } from '@/lib/demo-products';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const productId = String(form.get('product_id') ?? '');
  const product = findProduct(productId);
  if (!product) return NextResponse.json({ error: 'unknown product' }, { status: 404 });

  const demoKey = process.env.DEMO_API_KEY;
  if (!demoKey) return NextResponse.json({ error: 'DEMO_API_KEY not configured' }, { status: 500 });

  const r = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${demoKey}` },
    body: JSON.stringify({
      amount_zec: product.price_zec,
      memo_text: `Demo: ${product.name}`,
      reference: `demo_${product.id}_${Date.now()}`,
      description: product.name,
      expires_in: 1800,
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    return NextResponse.json({ error: 'invoice failed', detail: txt }, { status: 502 });
  }
  const invoice = await r.json();
  return NextResponse.redirect(invoice.checkout_url, 303);
}
