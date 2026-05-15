import type { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type DynHandler<C>   = (req: NextRequest, ctx: C) => Promise<NextResponse>;
type SimpleHandler   = (req: NextRequest) => Promise<NextResponse>;
type NoArgHandler    = () => Promise<NextResponse>;

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (!xff) return null;
  return xff.split(',')[0].trim() || null;
}

function userAgent(req: NextRequest): string | null {
  return (req.headers.get('user-agent') ?? '').slice(0, 500) || null;
}

function fireLog(payload: {
  merchant_id: string | null;
  api_key_id:  string | null;
  error_code:  string | null;
  method:      string;
  path:        string;
  status:      number;
  latency_ms:  number;
  user_agent:  string | null;
  ip:          string | null;
}): void {
  createAdminClient().from('api_requests').insert(payload).then(undefined, () => {});
}

export function withApiLog(handler: NoArgHandler): (req: NextRequest, ctx?: any) => Promise<NextResponse>;
export function withApiLog(handler: SimpleHandler): SimpleHandler;
export function withApiLog<C>(handler: DynHandler<C>): DynHandler<C>;
export function withApiLog(
  handler: (req: NextRequest, ctx?: any) => Promise<NextResponse>,
): (req: NextRequest, ctx?: any) => Promise<NextResponse> {
  return async (req, ctx) => {
    const start = Date.now();
    const path  = new URL(req.url).pathname;
    const ua    = userAgent(req);
    const ip    = clientIp(req);

    let res: NextResponse;
    try {
      res = await handler(req, ctx);
    } catch (err) {
      fireLog({
        merchant_id: null, api_key_id: null, error_code: 'internal',
        method:     req.method,
        path,
        status:     500,
        latency_ms: Date.now() - start,
        user_agent: ua,
        ip,
      });
      throw err;
    }

    const latency_ms  = Date.now() - start;
    const merchant_id = res.headers.get('x-zc-merchant-id') || null;
    const api_key_id  = res.headers.get('x-zc-api-key-id')  || null;
    const error_code  = res.headers.get('x-zc-error-code')  || null;

    fireLog({
      merchant_id, api_key_id, error_code,
      method:     req.method,
      path,
      status:     res.status,
      latency_ms,
      user_agent: ua,
      ip,
    });

    res.headers.delete('x-zc-merchant-id');
    res.headers.delete('x-zc-api-key-id');
    res.headers.delete('x-zc-error-code');
    return res;
  };
}
