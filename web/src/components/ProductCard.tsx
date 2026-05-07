import type { Product } from '../lib/catalog';

type Props = {
  product:  Product;
  onSelect: (id: string) => void;
};

export default function ProductCard({ product, onSelect }: Props) {
  return (
    <button
      onClick={() => onSelect(product.id)}
      className="group text-left bg-white rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 p-6 border border-zbucks-brown/5"
    >
      <div className="text-5xl mb-3">{product.emoji}</div>
      <h3 className="text-lg font-bold text-zbucks-brown">{product.name}</h3>
      <p className="text-sm text-zbucks-mute mt-1 leading-snug">{product.description}</p>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-xl font-black text-zbucks-green">{product.amountZec} ZEC</span>
        {product.kind === 'multi' && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-zbucks-gold bg-zbucks-gold/10 px-2 py-0.5 rounded-full">
            Multi-recipient
          </span>
        )}
      </div>
      <div className="mt-4 inline-block text-sm font-bold text-zbucks-green group-hover:underline">
        Pay with Zcash →
      </div>
    </button>
  );
}
