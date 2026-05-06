// Hardcoded product catalog for the Zbucks Coffee demo storefront.
// In a real merchant integration this would come from a database.

export type Product = {
  id:          string;
  emoji:       string;
  name:        string;
  description: string;
  amountZec:   string;       // total amount, displayed
} & (
  | { kind: 'single' }
  | { kind: 'multi'; payments: Array<{ amountZec: string; label: string }> }
);

export const CATALOG: Product[] = [
  {
    id:          'espresso',
    emoji:       '☕',
    name:        'Espresso',
    description: 'Single shot, served warm.',
    amountZec:   '0.01',
    kind:        'single',
  },
  {
    id:          'coldbrew',
    emoji:       '🧊',
    name:        'Cold Brew',
    description: 'Slow-steeped 18 hours.',
    amountZec:   '0.02',
    kind:        'single',
  },
  {
    id:          'beanbag',
    emoji:       '🛍️',
    name:        'Bean Bag (250g)',
    description: 'Whole bean, single origin.',
    amountZec:   '0.05',
    kind:        'single',
  },
  {
    id:          'coffeetip',
    emoji:       '💚',
    name:        'Coffee + Tip',
    description: 'Espresso plus a thank-you for the barista.',
    amountZec:   '0.015',
    kind:        'multi',
    payments: [
      { amountZec: '0.01',  label: 'Coffee' },
      { amountZec: '0.005', label: 'Tip' },
    ],
  },
];

export function findProduct(id: string): Product | undefined {
  return CATALOG.find(p => p.id === id);
}
