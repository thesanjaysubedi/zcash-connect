// ZIP-321 Payment Request URI implementation
// Spec: https://zips.z.cash/zip-0321

export interface PaymentRequest {
  address:  string;
  amount:   string;
  memo?:    string;
  label?:   string;
  message?: string;
}

export interface StructuredMemo {
  invoiceId: string;
  orderId?:  string;
  [key: string]: unknown;
}

function toBase64Url(text: string): string {
  return Buffer.from(text, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function buildMemo(data: StructuredMemo): string {
  const json    = JSON.stringify(data);
  const encoded = `ZC1:${toBase64Url(json)}`;
  const bytes   = Buffer.byteLength(encoded, 'utf8');
  if (bytes > 512) {
    throw new Error(`Memo too long: ${bytes} bytes (max 512)`);
  }
  return encoded;
}

export function buildPaymentUri(req: PaymentRequest): string {
  const params = new URLSearchParams();
  params.set('amount', req.amount);
  if (req.memo)    params.set('memo',    toBase64Url(req.memo));
  if (req.label)   params.set('label',   req.label);
  if (req.message) params.set('message', req.message);
  return `zcash:${req.address}?${params.toString().replace(/\+/g, '%20')}`;
}

// ── Parser ──────────────────────────────────────────────────────────
// Inverse of buildPaymentUri: zcash:<addr>?amount=...&memo=base64url(text)&...
//   → { address, amount, memo: text, label, message }
// Per ZIP-321 §URI Semantics, "zcash:<addr>?..." is equivalent to
// "zcash:?address=<addr>&...". This parser handles both forms.

function fromBase64Url(b64u: string): string {
  // base64url has no '=' padding; restore it for Buffer.from
  const padding = '='.repeat((4 - (b64u.length % 4)) % 4);
  const std     = b64u.replace(/-/g, '+').replace(/_/g, '/') + padding;
  return Buffer.from(std, 'base64').toString('utf8');
}

export function parsePaymentUri(uri: string): PaymentRequest {
  if (!uri.startsWith('zcash:')) {
    throw new Error(`parsePaymentUri: scheme must be zcash:, got "${uri.split(':')[0]}"`);
  }
  const after = uri.slice('zcash:'.length);
  if (after.startsWith('//')) {
    throw new Error('parsePaymentUri: authority component not allowed by ZIP-321 (no zcash://)');
  }

  // Split path-component (the leading address, if any) from the query string.
  const queryStart = after.indexOf('?');
  const pathPart  = queryStart === -1 ? after : after.slice(0, queryStart);
  const queryPart = queryStart === -1 ? ''    : after.slice(queryStart + 1);

  const params = new URLSearchParams(queryPart);

  // Address: prefer path segment, fall back to address= query param.
  let address = pathPart;
  if (!address) {
    const fromQuery = params.get('address');
    if (!fromQuery) {
      throw new Error('parsePaymentUri: missing address (neither in path nor query)');
    }
    address = fromQuery;
  }

  const amount = params.get('amount');
  if (!amount) {
    throw new Error('parsePaymentUri: missing required amount parameter');
  }

  const memoB64 = params.get('memo') ?? undefined;
  const label   = params.get('label') ?? undefined;
  const message = params.get('message') ?? undefined;

  return {
    address,
    amount,
    memo:    memoB64 ? fromBase64Url(memoB64) : undefined,
    label,
    message,
  };
}

// ── Multi-recipient build/parse (ZIP-321 §"URI Semantics") ───────────
// Multi-recipient URIs use the form  zcash:?address=A&amount=1&address.1=B&amount.1=2&...
// The empty paramindex is the first recipient. Subsequent recipients
// use ".1", ".2", etc. Leading zeros are FORBIDDEN by the ABNF
// (paramindex = "." NONZERO 0*3DIGIT).

const MULTI_INDEX_RE = /^\.(?:[1-9][0-9]{0,3})$/;

function appendIndexedParams(
  params: URLSearchParams,
  payment: PaymentRequest,
  suffix: string,
): void {
  params.set(`amount${suffix}`,            payment.amount);
  if (payment.memo)    params.set(`memo${suffix}`,    toBase64Url(payment.memo));
  if (payment.label)   params.set(`label${suffix}`,   payment.label);
  if (payment.message) params.set(`message${suffix}`, payment.message);
}

export function buildMultiPaymentUri(payments: PaymentRequest[]): string {
  if (payments.length === 0) {
    throw new Error('buildMultiPaymentUri: empty payments — at least one required');
  }
  if (payments.length === 1) {
    throw new Error('buildMultiPaymentUri: single payment — use buildPaymentUri instead');
  }

  const params = new URLSearchParams();
  // First payment uses the empty index.
  params.set('address', payments[0].address);
  appendIndexedParams(params, payments[0], '');
  // Subsequent payments use .1, .2, ...
  for (let i = 1; i < payments.length; i++) {
    const suffix = `.${i}`;
    params.set(`address${suffix}`, payments[i].address);
    appendIndexedParams(params, payments[i], suffix);
  }
  return `zcash:?${params.toString().replace(/\+/g, '%20')}`;
}

export function parseMultiPaymentUri(uri: string): PaymentRequest[] {
  if (!uri.startsWith('zcash:')) {
    throw new Error('parseMultiPaymentUri: scheme must be zcash:');
  }
  const queryStart = uri.indexOf('?');
  if (queryStart === -1) {
    throw new Error('parseMultiPaymentUri: missing query string');
  }
  const params = new URLSearchParams(uri.slice(queryStart + 1));

  // Group params by index suffix
  const groups = new Map<string, URLSearchParams>();   // key = '' or '.1' ...
  for (const [k, v] of params) {
    const dotIdx = k.indexOf('.');
    const base   = dotIdx === -1 ? k : k.slice(0, dotIdx);
    const suffix = dotIdx === -1 ? '' : k.slice(dotIdx);
    if (suffix !== '' && !MULTI_INDEX_RE.test(suffix)) {
      // forbid address.0, address.01, etc.
      throw new Error(`parseMultiPaymentUri: invalid paramindex "${suffix}" (leading zero or malformed) — address${suffix} rejected`);
    }
    if (!groups.has(suffix)) groups.set(suffix, new URLSearchParams());
    groups.get(suffix)!.set(base, v);
  }

  // Every group must have an address (per ZIP-321 §"URI Semantics")
  const out: { idx: number; payment: PaymentRequest }[] = [];
  for (const [suffix, group] of groups) {
    const addr = group.get('address');
    if (!addr) {
      throw new Error(`parseMultiPaymentUri: orphan params at index "${suffix}" — missing address${suffix}`);
    }
    const amount = group.get('amount');
    if (!amount) {
      throw new Error(`parseMultiPaymentUri: missing amount${suffix}`);
    }
    const memoB64 = group.get('memo') ?? undefined;
    const idx     = suffix === '' ? 0 : parseInt(suffix.slice(1), 10);
    out.push({
      idx,
      payment: {
        address: addr,
        amount,
        memo:    memoB64 ? fromBase64Url(memoB64) : undefined,
        label:   group.get('label')   ?? undefined,
        message: group.get('message') ?? undefined,
      },
    });
  }

  // Sort by index ascending so empty-index (0) comes first.
  out.sort((a, b) => a.idx - b.idx);
  return out.map(x => x.payment);
}
