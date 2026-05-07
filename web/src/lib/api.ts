// Typed fetch wrappers for the ZcashConnect server API.
// All errors throw with the server's `error` field as the message
// when the response status is non-2xx.

export type Receiver = {
  type:   'orchard' | 'sapling' | 'p2pkh' | 'p2sh' | 'unknown';
  typeId: number;
  length: number;
};

export type Merchant = {
  address: string;
  network: string;
  receiverDetails: {
    network:   string;
    receivers: Receiver[];
    isOrchardCapable: boolean;
  };
};

export type InvoiceStatus = 'CREATED' | 'DETECTING' | 'CONFIRMED' | 'EXPIRED';

export type Invoice = {
  invoiceId:      string;
  address:        string;
  amountZec:      string;
  paymentUri:     string;
  qrCode:         string;
  status:         InvoiceStatus;
  createdAt:      string;
  expiresAtBlock: number;
  currentBlock:   number;
  network:        string;
  kind:           'single' | 'multi';
  payments?:      Array<{ amountZec: string; label?: string }>;
};

export type ParsedSingle = { kind: 'single'; payment: { address: string; amount: string; memo?: string; label?: string; message?: string } };
export type ParsedMulti  = { kind: 'multi';  payments: Array<{ address: string; amount: string; memo?: string; label?: string; message?: string }> };

export type Health = {
  status:              'ok';
  network:             string;
  lightwalletdHost:    string;
  latestBlock:         number;
  lightwalletdVersion: string;
  merchantAddress:     string;
  observedAt:          string; // ISO 8601
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init);
  if (!r.ok) {
    const body = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(body.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export const api = {
  async getHealth(): Promise<Health> {
    return request<Health>('/health');
  },

  async getMerchant(): Promise<Merchant> {
    return request<Merchant>('/merchant');
  },

  async createInvoiceSingle(amountZec: string, orderId?: string): Promise<Invoice> {
    return request<Invoice>('/invoices', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ amountZec, orderId }),
    });
  },

  async createInvoiceMulti(payments: Array<{ amountZec: string; label?: string }>): Promise<Invoice> {
    return request<Invoice>('/invoices', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ payments }),
    });
  },

  async getInvoice(id: string): Promise<Invoice> {
    return request<Invoice>(`/invoices/${encodeURIComponent(id)}`);
  },

  async parseUri(uri: string): Promise<ParsedSingle | ParsedMulti> {
    return request<ParsedSingle | ParsedMulti>('/uris/parse', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ uri }),
    });
  },
};
