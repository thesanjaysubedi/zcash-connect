import { describe, it, expect } from 'vitest';
import { qrDataUrl } from '@/lib/qr';

describe('qrDataUrl', () => {
  it('returns a PNG data URL for a given ZIP-321 URI', async () => {
    const uri = 'zcash:u1xxx?amount=1.5';
    const url = await qrDataUrl(uri);
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(url).toMatch(/data:image\/png;base64,iVBORw0KGgo/);
    expect(url.length).toBeGreaterThan(200);
  });

  it('throws on empty input', async () => {
    await expect(qrDataUrl('')).rejects.toThrow(/empty/i);
  });
});
