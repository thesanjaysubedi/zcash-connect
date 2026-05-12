import { describe, it, expect } from 'vitest';
import { generateApiKey, parseApiKey, verifyApiKey, API_KEY_RE } from '@/lib/api-keys';

describe('generateApiKey', () => {
  it('returns full key, prefix, and hashed secret', async () => {
    const { fullKey, prefix, hashedSecret } = await generateApiKey();
    expect(fullKey).toMatch(API_KEY_RE);
    expect(prefix).toMatch(/^zk_live_[A-Za-z0-9_-]{8}$/);
    expect(fullKey.startsWith(prefix + '_')).toBe(true);
    expect(hashedSecret.startsWith('$2')).toBe(true); // bcrypt prefix
  });
});

describe('parseApiKey', () => {
  it('parses a well-formed key', () => {
    const r = parseApiKey('zk_live_abcdEFGH_' + 'x'.repeat(22));
    expect(r).toEqual({ prefix: 'zk_live_abcdEFGH', secret: 'x'.repeat(22) });
  });
  it('rejects malformed keys', () => {
    expect(parseApiKey('garbage')).toBeNull();
    expect(parseApiKey('zk_live_short_x')).toBeNull();
    expect(parseApiKey('zk_TEST_abcdEFGH_' + 'x'.repeat(22))).toBeNull();
  });
});

describe('verifyApiKey', () => {
  it('returns true for the original key', async () => {
    const { fullKey, hashedSecret } = await generateApiKey();
    const parsed = parseApiKey(fullKey);
    expect(parsed).not.toBeNull();
    const ok = await verifyApiKey(parsed!.secret, hashedSecret);
    expect(ok).toBe(true);
  });
  it('returns false for a wrong key', async () => {
    const { hashedSecret } = await generateApiKey();
    const ok = await verifyApiKey('not-the-secret', hashedSecret);
    expect(ok).toBe(false);
  });
});
