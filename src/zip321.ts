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
