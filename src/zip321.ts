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
  return `zcash:${req.address}?${params.toString()}`;
}
