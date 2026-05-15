import { NextRequest, NextResponse } from 'next/server';
import { createDemoSandbox } from '@/lib/demo-provision';
import { apiError } from '@/lib/error-envelope';

// Cookie-based rate-limit for one-click demo provisioning.
// Per-browser, not per-IP. A determined visitor can bypass this in
// incognito or by clearing the cookie. The cookie value is the ISO
// timestamp of the last demo creation; we don't sign it because the
// real backstop is the 7-day demo expiry sweep (cron Sweep #4),
// not this client-side check. Treat this as spam mitigation only.
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
    maxAge: WINDOW_MS / 1000,
  });
  return res;
}
