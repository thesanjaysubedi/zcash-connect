import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError } from '@/lib/error-envelope';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('status, paid_at, expires_at')
    .eq('id', id)
    .single();
  if (error || !data) return apiError(404, 'not_found', 'Invoice not found');
  return NextResponse.json({
    status: data.status, paid_at: data.paid_at, expires_at: data.expires_at,
  }, { headers: { 'cache-control': 'no-store' } });
}
