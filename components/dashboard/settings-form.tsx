'use client';

import { useState } from 'react';
import { saveSettings } from '@/app/(dashboard)/dashboard/settings/save';

export interface SettingsFormInitial {
  storeName: string;
  payoutAddress: string;
  contactEmail: string;
  supportUrl: string;
  brandColor: string;
  logoUrl: string;
}

export function SettingsForm(props: { initial: SettingsFormInitial }) {
  const [storeName, setStoreName] = useState(props.initial.storeName);
  const [payoutAddress, setPayoutAddress] = useState(props.initial.payoutAddress);
  const [contactEmail, setContactEmail] = useState(props.initial.contactEmail);
  const [supportUrl, setSupportUrl] = useState(props.initial.supportUrl);
  const [brandColor, setBrandColor] = useState(props.initial.brandColor);
  const [logoUrl, setLogoUrl] = useState(props.initial.logoUrl);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSaved(false); setLoading(true);
    const r = await saveSettings({
      store_name: storeName,
      payout_address: payoutAddress,
      contact_email: contactEmail || undefined,
      support_url:   supportUrl   || undefined,
      brand_color:   brandColor   || undefined,
      logo_url:      logoUrl      || undefined,
    });
    setLoading(false);
    if (!r.ok) { setError(r.error ?? 'Failed to save'); return; }
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Payment</h2>
        <div>
          <label className="block text-sm font-medium">Store name</label>
          <input value={storeName} onChange={(e) => setStoreName(e.target.value)}
                 className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Payout address (Orchard UA, u1…)</label>
          <textarea rows={3} value={payoutAddress} onChange={(e) => setPayoutAddress(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm" />
        </div>
      </section>

      <section className="space-y-4 border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-900">Brand &amp; contact</h2>
        <p className="text-xs text-gray-600">These appear on the hosted checkout page customers see when paying.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Contact email</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                   placeholder="support@yourstore.com"
                   className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Support URL</label>
            <input type="url" value={supportUrl} onChange={(e) => setSupportUrl(e.target.value)}
                   placeholder="https://yourstore.com/help"
                   className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Brand color</label>
            <div className="mt-1 flex items-center gap-2">
              <input value={brandColor} onChange={(e) => setBrandColor(e.target.value)}
                     placeholder="#1a2b3c"
                     className="w-32 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm" />
              {/^#[0-9a-fA-F]{6}$/.test(brandColor) && (
                <span className="h-8 w-8 rounded border border-gray-300"
                      style={{ backgroundColor: brandColor }} />
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Logo URL</label>
            <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                   placeholder="https://yourstore.com/logo.png"
                   className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}
      <button type="submit" disabled={loading}
        className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50">
        {loading ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}
