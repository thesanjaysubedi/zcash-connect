import Link from 'next/link';

function formatExpiry(iso: string | null): string {
  if (!iso) return 'soon';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const hours = Math.round(ms / 3600_000);
  if (hours < 48) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  return `in ${Math.round(hours / 24)} days`;
}

export function DemoBanner({ expiresAt }: { expiresAt: string | null }) {
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-sm text-amber-900 px-4 py-2">
      <span className="font-medium">Demo store</span> · expires {formatExpiry(expiresAt)} ·{' '}
      <Link href="/#waitlist" className="underline hover:no-underline">
        Join the waitlist to keep building
      </Link>
    </div>
  );
}
