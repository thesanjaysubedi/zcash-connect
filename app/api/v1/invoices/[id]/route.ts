import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-auth';
import { getInvoiceForMerchant } from '@/lib/invoice-service';
import { apiError } from '@/lib/error-envelope';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiKey(req.headers);
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);
  const { id } = await ctx.params;
  try {
    const invoice = await getInvoiceForMerchant(id, auth.merchantId, auth.storeName);
    if (!invoice) return apiError(404, 'not_found', 'Invoice not found');
    return NextResponse.json(invoice);
  } catch (e) {
    console.error('[GET /api/v1/invoices/:id] getInvoiceForMerchant failed:', e);
    return apiError(500, 'internal', 'Failed to fetch invoice');
  }
}
