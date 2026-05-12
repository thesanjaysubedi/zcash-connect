import bcrypt from 'bcrypt';
import { generateApiKeySecret } from './id';

export const API_KEY_RE = /^zk_live_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{22}$/;

export interface NewApiKey {
  fullKey: string;       // shown to user once
  prefix: string;        // "zk_live_<8>" — stored visibly
  hashedSecret: string;  // bcrypt of the 22-char secret
}

export async function generateApiKey(): Promise<NewApiKey> {
  const prefixSuffix = generateApiKeySecret().slice(0, 8);
  const secret = generateApiKeySecret();
  const prefix = `zk_live_${prefixSuffix}`;
  const fullKey = `${prefix}_${secret}`;
  const hashedSecret = await bcrypt.hash(secret, 10);
  return { fullKey, prefix, hashedSecret };
}

// The prefix is always "zk_live_" (8 chars) + 8 random chars = 16 chars.
// The separator underscore is always at index 16; do NOT use lastIndexOf('_')
// because the 22-char secret may itself contain underscores.
const PREFIX_LEN = 16; // "zk_live_" + 8 chars

export function parseApiKey(input: string): { prefix: string; secret: string } | null {
  if (!API_KEY_RE.test(input)) return null;
  return { prefix: input.slice(0, PREFIX_LEN), secret: input.slice(PREFIX_LEN + 1) };
}

export function verifyApiKey(secret: string, hashedSecret: string): Promise<boolean> {
  return bcrypt.compare(secret, hashedSecret);
}
