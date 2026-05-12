export interface Zip321Params {
  address: string;
  amount_zatoshis: bigint;
  memo_text?: string;
  label?: string;
  message?: string;
}

export function zatoshisToZecString(z: bigint): string {
  if (z < 0n) throw new Error('zatoshis must be non-negative');
  const intPart = z / 100_000_000n;
  const fracPart = z % 100_000_000n;
  if (fracPart === 0n) return intPart.toString();
  const frac = fracPart.toString().padStart(8, '0').replace(/0+$/, '');
  return `${intPart}.${frac}`;
}

function toBase64Url(text: string): string {
  return Buffer.from(text, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function buildZip321Uri(p: Zip321Params): string {
  const parts: string[] = [];
  parts.push(`amount=${zatoshisToZecString(p.amount_zatoshis)}`);
  if (p.memo_text && p.memo_text.length > 0) {
    parts.push(`memo=${toBase64Url(p.memo_text)}`);
  }
  if (p.label && p.label.length > 0) parts.push(`label=${encodeURIComponent(p.label)}`);
  if (p.message && p.message.length > 0) parts.push(`message=${encodeURIComponent(p.message)}`);
  return `zcash:${p.address}?${parts.join('&')}`;
}
