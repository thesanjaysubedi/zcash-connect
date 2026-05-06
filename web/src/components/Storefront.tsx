import { CATALOG } from '../lib/catalog';
import ProductCard from './ProductCard';

type Props = {
  onSelect: (id: string) => void;
};

export default function Storefront({ onSelect }: Props) {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-black text-zbucks-brown">Today's menu</h2>
        <p className="text-zbucks-mute text-sm mt-1">
          Pay shielded with Zcash. Scan a QR with any ZIP-321-compatible wallet.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATALOG.map((product) => (
          <ProductCard key={product.id} product={product} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
