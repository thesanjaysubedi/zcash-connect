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

export function parseApiKey(input: string): { prefix: string; secret: string } | null {
  if (!API_KEY_RE.test(input)) return null;
  const idx = input.lastIndexOf('_');
  return { prefix: input.slice(0, idx), secret: input.slice(idx + 1) };
}

export function verifyApiKey(secret: string, hashedSecret: string): Promise<boolean> {
  return bcrypt.compare(secret, hashedSecret);
}
