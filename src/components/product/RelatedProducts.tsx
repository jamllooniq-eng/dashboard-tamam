import React from 'react';
import { RolemallProduct } from '../../types';
import { ProductCard } from '../home/ProductCard';
import { Sparkles } from 'lucide-react';

interface RelatedProductsProps {
  products: RolemallProduct[];
  currentProductId: string | number;
  onSelectProduct: (product: RolemallProduct) => void;
}

export const RelatedProducts: React.FC<RelatedProductsProps> = ({
  products,
  currentProductId,
  onSelectProduct,
}) => {
  const filtered = products
    .filter((p) => String(p.id) !== String(currentProductId))
    .slice(0, 4);

  if (filtered.length === 0) return null;

  return (
    <div id="related-products-section" className="mt-14 pt-10 border-t border-[#E5E5E5]">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-[#22A39E]" />
        <h3 className="text-lg sm:text-xl font-bold text-black">
          منتجات قد تنال إعجابك أيضاً
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((prod) => (
          <ProductCard
            key={String(prod.id)}
            product={prod}
            onSelect={onSelectProduct}
          />
        ))}
      </div>
    </div>
  );
};
