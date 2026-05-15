import { NextRequest, NextResponse } from 'next/server';
import { joinWaitlist } from '@/lib/waitlist';
import { apiError } from '@/lib/error-envelope';

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError(400, 'invalid_body', 'Request body must be JSON'); }

  if (typeof body !== 'object' || body === null) {
    return apiError(400, 'invalid_body', 'Request body must be a JSON object');
  }

  const { email, source } = body as { email?: unknown; source?: unknown };
  if (typeof email !== 'string') {
    return apiError(400, 'validation_error', 'email is required and must be a string', 'email');
  }

  const r = await joinWaitlist({
    email,
    source: typeof source === 'string' ? source : undefined,
  });
  if (!r.ok) {
    if (r.kind === 'validation') return apiError(400, 'validation_error', r.error);
    console.error('joinWaitlist internal error:', r.error);
    return apiError(500, 'internal_error', 'Could not submit. Try again later.');
  }
  return NextResponse.json({ ok: true });
}
