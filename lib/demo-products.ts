export interface DemoProduct {
  id: string;
  name: string;
  price_zec: string;
  description: string;
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  { id: 'tshirt', name: 'Zcash T-shirt (Orchard)', price_zec: '0.001', description: 'Cotton tee with the Orchard logo.' },
  { id: 'sticker-pack', name: 'Sticker Pack', price_zec: '0.001', description: '10 holographic Zcash stickers.' },
  { id: 'mug', name: 'Shielded Mug', price_zec: '0.001', description: '11oz ceramic, white with a u1 print.' },
];

export function findProduct(id: string): DemoProduct | undefined {
  return DEMO_PRODUCTS.find((p) => p.id === id);
}
