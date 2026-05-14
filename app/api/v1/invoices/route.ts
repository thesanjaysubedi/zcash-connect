import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey } from '@/lib/api-auth';
import { parseInvoiceCreate } from '@/lib/validation';
import { createInvoice, listInvoicesForMerchant } from '@/lib/invoice-service';
import { apiError } from '@/lib/error-envelope';

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers);
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError(400, 'invalid_json', 'Request body must be valid JSON'); }

  let parsed;
  try { parsed = parseInvoiceCreate(body); }
  catch (e) {
    const ze = e as z.ZodError;
    const first = ze.issues?.[0];
    return apiError(422,
      first?.path?.[0] ? `invalid_${first.path[0]}` : 'invalid_request',
      first?.message ?? (e as Error).message,
      first?.path?.[0] as string | undefined);
  }

  try {
    const dto = await createInvoice({
      merchantId: auth.merchantId,
      payoutAddress: auth.payoutAddress,
      storeName: auth.storeName,
      amount_zec: parsed.amount_zec,
      memo_text: parsed.memo_text,
      reference: parsed.reference,
      description: parsed.description,
      expires_in: parsed.expires_in,
    });
    return NextResponse.json(dto, { status: 201 });
  } catch (e) {
    return apiError(500, 'internal', (e as Error).message);
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers);
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const limitRaw = url.searchParams.get('limit');
  const limit = Math.min(100, Math.max(1, Number(limitRaw ?? '50') || 50));
  const before = url.searchParams.get('before') ?? undefined;

  try {
    const r = await listInvoicesForMerchant(auth.merchantId, auth.storeName, { status, limit, before });
    return NextResponse.json(r);
  } catch (e) {
    console.error('[GET /api/v1/invoices] listInvoicesForMerchant failed:', e);
    return apiError(500, 'internal', 'Failed to list invoices');
  }
}
