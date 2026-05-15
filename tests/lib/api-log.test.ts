import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
const fromSpy   = vi.fn(() => ({ insert: insertSpy }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: fromSpy }),
}));

import { withApiLog } from '@/lib/api-log';

const make = (url: string, opts: { method?: string; headers?: Record<string,string> } = {}) =>
  new NextRequest(new URL(url), {
    method: opts.method ?? 'GET',
    headers: new Headers(opts.headers ?? {}),
  });

describe('withApiLog', () => {
  beforeEach(() => { insertSpy.mockClear(); fromSpy.mockClear(); });

  it('captures method/path/status/latency and strips sentinel headers', async () => {
    const handler = withApiLog(async () => {
      const res = NextResponse.json({ ok: true }, { status: 201 });
      res.headers.set('x-zc-merchant-id', 'm-1');
      res.headers.set('x-zc-api-key-id',  'k-1');
      return res;
    });
    const req = make('http://x/api/v1/invoices?foo=bar', {
      method: 'POST',
      headers: { 'user-agent': 'curl/8.0', 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    const res = await handler(req, {});
    // Allow the fire-and-forget insert to flush
    await new Promise((r) => setImmediate(r));

    expect(res.status).toBe(201);
    expect(res.headers.get('x-zc-merchant-id')).toBeNull();
    expect(res.headers.get('x-zc-api-key-id')).toBeNull();

    expect(fromSpy).toHaveBeenCalledWith('api_requests');
    const payload = insertSpy.mock.calls[0][0];
    expect(payload).toMatchObject({
      merchant_id: 'm-1',
      api_key_id:  'k-1',
      method:      'POST',
      path:        '/api/v1/invoices',
      status:      201,
      user_agent:  'curl/8.0',
      ip:          '203.0.113.5',
    });
    expect(payload.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('logs error_code and leaves merchant_id null when auth failed', async () => {
    const handler = withApiLog(async () => {
      const res = NextResponse.json({ error: { code: 'unauthorized', message: 'x' } }, { status: 401 });
      res.headers.set('x-zc-error-code', 'unauthorized');
      return res;
    });
    const res = await handler(make('http://x/api/v1/invoices'), {});
    await new Promise((r) => setImmediate(r));

    expect(res.status).toBe(401);
    expect(res.headers.get('x-zc-error-code')).toBeNull();
    const payload = insertSpy.mock.calls[0][0];
    expect(payload.merchant_id).toBeNull();
    expect(payload.api_key_id).toBeNull();
    expect(payload.error_code).toBe('unauthorized');
  });

  it('logs synthetic 500 and re-throws when the inner handler throws', async () => {
    const boom = new Error('boom');
    const handler = withApiLog(async () => { throw boom; });
    await expect(handler(make('http://x/api/v1/invoices', { method: 'POST' }), {})).rejects.toBe(boom);
    await new Promise((r) => setImmediate(r));
    const payload = insertSpy.mock.calls[0][0];
    expect(payload).toMatchObject({
      merchant_id: null,
      api_key_id:  null,
      error_code:  'internal',
      method:      'POST',
      path:        '/api/v1/invoices',
      status:      500,
    });
  });

  it('logs null sentinels when the handler sets none', async () => {
    const handler = withApiLog(async () => NextResponse.json({ ok: true }, { status: 200 }));
    await handler(make('http://x/api/v1/invoices'), {});
    await new Promise((r) => setImmediate(r));
    const payload = insertSpy.mock.calls[0][0];
    expect(payload.merchant_id).toBeNull();
    expect(payload.api_key_id).toBeNull();
    expect(payload.error_code).toBeNull();
  });
});
