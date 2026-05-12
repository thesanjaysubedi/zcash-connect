import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function randomString(len: number): string {
  // 16 bytes of entropy per 22 characters is fine for unguessable IDs.
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i += 1) out += ALPHABET[bytes[i] & 0x3f];
  return out;
}

export const INVOICE_ID_RE = /^inv_[A-Za-z0-9_-]{22}$/;

export function generateInvoiceId(): string {
  return `inv_${randomString(22)}`;
}

/** 22 URL-safe characters; used as the secret half of an API key. */
export function generateApiKeySecret(): string {
  return randomString(22);
}
