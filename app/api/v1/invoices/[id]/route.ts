import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-auth';
import { getInvoiceForMerchant } from '@/lib/invoice-service';
import { apiError } from '@/lib/error-envelope';
import { withApiLog } from '@/lib/api-log';

async function handleGet(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiKey(req.headers);
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);
  const { id } = await ctx.params;
  try {
    const invoice = await getInvoiceForMerchant(id, auth.merchantId, auth.storeName);
    if (!invoice) return apiError(404, 'not_found', 'Invoice not found');
    const res = NextResponse.json(invoice);
    res.headers.set('x-zc-merchant-id', auth.merchantId);
    res.headers.set('x-zc-api-key-id',  auth.apiKeyId);
    return res;
  } catch (e) {
    console.error('[GET /api/v1/invoices/:id] getInvoiceForMerchant failed:', e);
    return apiError(500, 'internal', 'Failed to fetch invoice');
  }
}

export const GET = withApiLog(handleGet);
