import React from 'react';
import { Check } from 'lucide-react';

interface ProductFeaturesProps {
  features?: string[];
}

export const ProductFeatures: React.FC<ProductFeaturesProps> = ({ features }) => {
  if (!features || features.length === 0) return null;

  return (
    <div id="product-features-box" className="pt-3 border-t border-gray-100/90">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {features.map((feature, idx) => (
          <div 
            key={idx} 
            className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-800 bg-gray-50/70 border border-gray-100/80 px-3.5 py-2.5 rounded-xl font-medium"
          >
            <div className="w-5 h-5 rounded-full bg-[#22A39E]/10 flex items-center justify-center text-[#22A39E] shrink-0">
              <Check className="w-3 h-3 stroke-[2.5]" />
            </div>
            <span className="leading-snug">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

