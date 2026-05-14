import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-auth';
import { apiError } from '@/lib/error-envelope';
import { withApiLog } from '@/lib/api-log';

async function handleGet(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers);
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);

  const res = NextResponse.json({
    ok: true,
    merchant_id: auth.merchantId,
    store_name:  auth.storeName,
    server_time: new Date().toISOString(),
  });
  res.headers.set('x-zc-merchant-id', auth.merchantId);
  res.headers.set('x-zc-api-key-id',  auth.apiKeyId);
  return res;
}

export const GET = withApiLog(handleGet);
