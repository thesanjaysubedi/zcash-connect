import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError } from '@/lib/error-envelope';

const STATUS_VALUES = ['pending', 'verified', 'archived'] as const;
type Status = (typeof STATUS_VALUES)[number];

function isStatus(value: string | null): value is Status {
  return value !== null && (STATUS_VALUES as readonly string[]).includes(value);
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) return apiError(401, 'unauthorized', 'Admin authentication required');

  const status = new URL(req.url).searchParams.get('status');
  if (status !== null && !isStatus(status)) {
    return apiError(400, 'validation_error',
      `status must be one of: ${STATUS_VALUES.join(', ')}`, 'status');
  }

  const supabase = createAdminClient();
  let q = supabase.from('merchants').select(
    'id, store_name, contact_email, verified, verified_at, archived_at, payout_address, created_at',
  );

  if (status === 'pending')       q = q.eq('verified', false).is('archived_at', null);
  else if (status === 'verified') q = q.eq('verified', true).is('archived_at', null);
  else if (status === 'archived') q = q.not('archived_at', 'is', null);

  const { data, error } = await q.order('created_at', { ascending: false }).limit(200);
  if (error) {
    console.error('admin list merchants error:', error);
    return apiError(500, 'internal_error', 'Failed to list merchants');
  }
  return NextResponse.json({ merchants: data });
}
