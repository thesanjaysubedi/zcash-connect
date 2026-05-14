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
  const failures: string[] = [];

  // Sweep #1 — expire open invoices past their deadline.
  let invoices_expired = 0;
  try {
    const { data, error } = await supabase
      .from('invoices')
      .update({ status: 'expired', updated_at: now })
      .lt('expires_at', now)
      .eq('status', 'open')
      .select('id');
    if (error) failures.push(`invoices: ${error.message}`);
    else invoices_expired = data?.length ?? 0;
  } catch (e) {
    failures.push(`invoices: ${(e as Error).message}`);
  }

  // Sweep #2 — revoke api_keys whose expires_at has passed and that aren't already revoked.
  let keys_expired = 0;
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .update({ revoked_at: now })
      .lt('expires_at', now)
      .is('revoked_at', null)
      .select('id');
    if (error) failures.push(`keys: ${error.message}`);
    else keys_expired = data?.length ?? 0;
  } catch (e) {
    failures.push(`keys: ${(e as Error).message}`);
  }

  // Sweep #3 — purge api_requests rows older than 90 days.
  let logs_purged = 0;
  try {
    const cutoff = new Date(Date.parse(now) - 90 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('api_requests')
      .delete()
      .lt('created_at', cutoff)
      .select('id');
    if (error) failures.push(`logs: ${error.message}`);
    else logs_purged = data?.length ?? 0;
  } catch (e) {
    failures.push(`logs: ${(e as Error).message}`);
  }

  return NextResponse.json({
    expired: invoices_expired, // legacy field — preserve for existing callers (smoke script)
    invoices_expired,
    keys_expired,
    logs_purged,
    failures,
  });
}

export async function GET(req: NextRequest) { return POST(req); }
