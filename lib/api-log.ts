import type { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Handler<C> = (req: NextRequest, ctx: C) => Promise<NextResponse>;

export function withApiLog<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    const start = Date.now();
    const path  = new URL(req.url).pathname;
    const res   = await handler(req, ctx);
    const latency_ms = Date.now() - start;

    const merchant_id = res.headers.get('x-zc-merchant-id') || null;
    const api_key_id  = res.headers.get('x-zc-api-key-id')  || null;
    const error_code  = res.headers.get('x-zc-error-code')  || null;
    const ua          = (req.headers.get('user-agent') ?? '').slice(0, 500) || null;
    const ip          = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;

    void createAdminClient().from('api_requests').insert({
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
