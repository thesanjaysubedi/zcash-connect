import { NextRequest, NextResponse } from 'next/server';
import { createDemoSandbox } from '@/lib/demo-provision';
import { apiError } from '@/lib/error-envelope';

const COOKIE = 'zc_last_demo_at';
const WINDOW_MS = 60_000;

function readCookie(req: NextRequest, name: string): string | undefined {
  // Prefer NextRequest's cookies API when available (real Next runtime).
  const fromApi = req.cookies?.get?.(name)?.value;
  if (fromApi) return fromApi;
  // Fallback: parse the raw Cookie header (covers plain Request in tests).
  const header = req.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const raw = readCookie(req, COOKIE);
  if (raw) {
    const ts = Date.parse(decodeURIComponent(raw));
    if (!Number.isNaN(ts) && Date.now() - ts < WINDOW_MS) {
      return apiError(429, 'rate_limited', 'Wait a minute before creating another demo');
    }
  }

  try {
    await createDemoSandbox();
  } catch (e) {
    console.error('demo provisioning failed:', e);
    return apiError(500, 'internal_error', 'Could not create demo. Try again in a minute.');
  }

  const res = NextResponse.json({ ok: true, redirect: '/dashboard' });
  res.cookies.set(COOKIE, new Date().toISOString(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60,
  });
  return res;
}
