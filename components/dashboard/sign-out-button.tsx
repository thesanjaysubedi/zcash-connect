'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';

export function SignOutButton() {
  const router = useRouter();
  async function onClick() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }
  return (
    <button
      onClick={onClick}
      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
    >
      Sign out
    </button>
  );
}
