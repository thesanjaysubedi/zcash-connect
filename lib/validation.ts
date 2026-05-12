import { z } from 'zod';

// --------------------------------------------------------------------
// Address (heuristic only — full Bech32m validation is Phase 3)
// --------------------------------------------------------------------
export function isOrchardUnifiedAddress(addr: string): boolean {
  return typeof addr === 'string' && addr.startsWith('u1') && addr.length >= 80;
}

const payoutAddress = z.string().refine(isOrchardUnifiedAddress, {
  message: 'must be an Orchard unified address starting with "u1"',
});

// --------------------------------------------------------------------
// Amount — decimal string to BigInt zatoshis (1 ZEC = 1e8 zatoshis)
// --------------------------------------------------------------------
const ZEC_DECIMALS = 8n;

export function parseAmountZec(input: string): bigint {
  if (!/^\d+(\.\d+)?$/.test(input)) throw new Error('amount must be a positive decimal number');
  const [intPart, fracRaw = ''] = input.split('.');
  if (fracRaw.length > Number(ZEC_DECIMALS)) {
    throw new Error('amount must have at most 8 fractional digits');
  }
  const frac = fracRaw.padEnd(Number(ZEC_DECIMALS), '0');
  const zatoshis = BigInt(intPart) * 10n ** ZEC_DECIMALS + BigInt(frac);
  if (zatoshis <= 0n) throw new Error('amount must be positive');
  return zatoshis;
}

// --------------------------------------------------------------------
// Form schemas
// --------------------------------------------------------------------
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),  // bcrypt limits
  store_name: z.string().min(1).max(100),
});
export function parseSignupForm(input: unknown) { return signupSchema.parse(input); }

export const settingsSchema = z.object({
  store_name: z.string().min(1).max(100),
  payout_address: payoutAddress,
});
export function parseSettingsForm(input: unknown) { return settingsSchema.parse(input); }

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(50),
});
export function parseApiKeyCreate(input: unknown) { return apiKeyCreateSchema.parse(input); }

// --------------------------------------------------------------------
// Invoice payload — validated at the API boundary
// --------------------------------------------------------------------
function byteLen(s: string): number { return new TextEncoder().encode(s).length; }

export const invoiceCreateSchema = z.object({
  amount_zec: z.string().refine((v) => {
    try { parseAmountZec(v); return true; } catch { return false; }
  }, { message: 'invalid amount_zec' }),
  memo_text: z.string().refine((s) => byteLen(s) <= 512,
    { message: 'memo_text exceeds 512 bytes' }).optional(),
  reference: z.string().max(128).optional(),
  description: z.string().max(512).optional(),
  expires_in: z.number().int().positive().max(86400).default(3600),
});
export function parseInvoiceCreate(input: unknown) {
  return invoiceCreateSchema.parse(input);
}
