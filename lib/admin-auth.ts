import { createClient } from '@/lib/supabase/server';

export interface AdminUser {
  id: string;
  email: string;
}

function adminEmailList(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailList().includes(email.toLowerCase());
}

export async function requireAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  if (!isAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email };
}
