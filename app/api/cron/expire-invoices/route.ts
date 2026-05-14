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
