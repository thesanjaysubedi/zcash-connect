import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseAdminVerify } from '@/lib/validation';
import { apiError } from '@/lib/error-envelope';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminUser();
  if (!admin) return apiError(401, 'unauthorized', 'Admin authentication required');

  const { id } = await params;
  try { parseAdminVerify({ merchant_id: id }); }
  catch (e) { return apiError(400, 'validation_error', (e as Error).message, 'merchant_id'); }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('merchants')
    .update({ verified: true, verified_at: new Date().toISOString() })
    .eq('id', id)
    .eq('verified', false)
    .select('id, store_name, verified, verified_at')
    .maybeSingle();

  if (error) {
    console.error('admin verify error:', error);
    return apiError(500, 'internal_error', 'Failed to verify merchant');
  }
  if (!data) {
    return apiError(404, 'merchant_not_found', 'No pending merchant with that id');
  }
  return NextResponse.json({ merchant: data });
}
