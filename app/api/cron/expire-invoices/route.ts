import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const provided = req.headers.get('authorization') ?? req.headers.get('x-cron-secret');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!provided || (provided !== expected && provided !== process.env.CRON_SECRET)) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Bad cron secret' } }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .lt('expires_at', new Date().toISOString())
    .eq('status', 'open')
    .select('id');

  if (error) return NextResponse.json({ error: { code: 'internal', message: error.message } }, { status: 500 });

  return NextResponse.json({ expired: data?.length ?? 0 });
}

export async function GET(req: NextRequest) { return POST(req); }
