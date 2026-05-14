import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: { code: 'internal', message: 'CRON_SECRET not configured' } },
      { status: 500 },
    );
  }

  const provided = req.headers.get('authorization');
  if (provided !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Bad cron secret' } },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Sweep #1 — expire open invoices past their deadline (existing behaviour).
  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'expired', updated_at: now })
    .lt('expires_at', now)
    .eq('status', 'open')
    .select('id');

  if (error) return NextResponse.json({ error: { code: 'internal', message: error.message } }, { status: 500 });

  const invoices_expired = data?.length ?? 0;

  // Sweep #2 — revoke api_keys whose expires_at has passed and that aren't already revoked.
  const { data: keysData, error: keysErr } = await supabase
    .from('api_keys')
    .update({ revoked_at: now })
    .lt('expires_at', now)
    .is('revoked_at', null)
    .select('id');

  if (keysErr) return NextResponse.json({ error: { code: 'internal', message: keysErr.message } }, { status: 500 });

  const keys_expired = keysData?.length ?? 0;

  // Sweep #3 — purge api_requests rows older than 90 days.
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const { data: purgeData, error: purgeErr } = await supabase
    .from('api_requests')
    .delete()
    .lt('created_at', cutoff)
    .select('id');

  if (purgeErr) return NextResponse.json({ error: { code: 'internal', message: purgeErr.message } }, { status: 500 });

  const logs_purged = purgeData?.length ?? 0;

  return NextResponse.json({
    expired: invoices_expired, // legacy field — preserve for existing callers (smoke script)
    invoices_expired,
    keys_expired,
    logs_purged,
  });
}

export async function GET(req: NextRequest) { return POST(req); }
