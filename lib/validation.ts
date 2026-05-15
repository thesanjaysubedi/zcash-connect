import { z } from 'zod';

// --------------------------------------------------------------------
// Address (heuristic only — full Bech32m validation is Phase 3)
// Mainnet UAs start with "u1...", testnet UAs start with "utest1..."
// --------------------------------------------------------------------
export function isOrchardUnifiedAddress(addr: string): boolean {
  if (typeof addr !== 'string' || addr.length < 80) return false;
  return addr.startsWith('u1') || addr.startsWith('utest1');
}

const payoutAddress = z.string().refine(isOrchardUnifiedAddress, {
  message: 'must be an Orchard unified address (mainnet "u1…" or testnet "utest1…")',
});

// Treat '' as "not provided" so optional fields can be cleared via empty input.
const optionalEmail = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().email().max(254).optional(),
);
const optionalUrl = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().url().max(2048).optional(),
);
const optionalHexColor = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like #1a2b3c').optional(),
);

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
  contact_email: optionalEmail,
  support_url:   optionalUrl,
  brand_color:   optionalHexColor,
  logo_url:      optionalUrl,
});
export function parseSettingsForm(input: unknown) { return settingsSchema.parse(input); }

export const apiKeyRenameSchema = z.object({
  id:   z.string().uuid(),
  name: z.string().min(1).max(50),
});
export function parseApiKeyRename(input: unknown) { return apiKeyRenameSchema.parse(input); }

export const adminVerifySchema = z.object({
  merchant_id: z.string().uuid(),
});
export function parseAdminVerify(input: unknown) { return adminVerifySchema.parse(input); }

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
