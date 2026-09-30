import React from 'react';
import { RolemallProduct } from '../../types';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { getOptimizedImageUrl } from '../../lib/image';

interface ProductCardProps {
  product: RolemallProduct;
  onSelect: (product: RolemallProduct) => void;
  priority?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect, priority = false }) => {
  const imageUrl = product.image
    ? getOptimizedImageUrl(product.image, { width: 480, quality: 80, fit: 'contain' })
    : '';

  return (
    <div
      id={`product-card-${product.id}`}
      className="bg-white border border-gray-200/85 hover:border-[#22A39E]/60 rounded-2xl overflow-hidden flex flex-col justify-between hover:shadow-md transition-all duration-300 group"
    >
      {/* Image container */}
      <div
        className="relative aspect-square bg-[#F9FAFB] overflow-hidden cursor-pointer flex items-center justify-center p-3 sm:p-4"
        onClick={() => onSelect(product)}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            loading={priority ? 'eager' : 'lazy'}
            referrerPolicy="no-referrer"
            decoding="async"
            {...(priority ? { fetchPriority: 'high' } : {})}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const target = e.currentTarget;
              if (product.image && target.src !== product.image) {
                target.src = product.image;
              }
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <ShoppingBag className="w-10 h-10 mb-2 opacity-50" />
            <span className="text-xs">تمام شوب</span>
          </div>
        )}

        {/* Real Discount Badge if old_price is present */}
        {product.old_price && product.old_price > product.price && (
          <div className="absolute top-2.5 left-2.5 bg-[#22A39E] text-white text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
            وفر {(product.old_price - product.price).toLocaleString('en-US')} د.ع
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between min-w-0 bg-white">
        <div className="min-w-0">
          {/* Category Tag */}
          {product.category && (
            <span className="text-[11px] text-gray-400 font-medium block mb-1 truncate">
              {product.category}
            </span>
          )}

          {/* Product Title */}
          <h3
            onClick={() => onSelect(product)}
            className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-2 leading-snug cursor-pointer group-hover:text-[#22A39E] transition-colors mb-3 break-words"
            title={product.title}
          >
            {product.title}
          </h3>
        </div>

        {/* Price & CTA Button */}
        <div className="pt-2.5 border-t border-gray-100 min-w-0">
          <div className="flex items-baseline justify-between mb-2.5 sm:mb-3 min-w-0 gap-1 flex-wrap">
            <div className="min-w-0 flex items-baseline">
              <span className="text-sm sm:text-base md:text-lg font-black text-[#22A39E] truncate">
                {product.price.toLocaleString('en-US')}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-gray-500 mr-1 shrink-0">
                د.ع
              </span>
            </div>

            {product.old_price && product.old_price > product.price && (
              <span className="text-[10px] sm:text-xs text-gray-400 line-through shrink-0">
                {product.old_price.toLocaleString('en-US')} د.ع
              </span>
            )}
          </div>

          <button
            id={`order-btn-${product.id}`}
            onClick={() => onSelect(product)}
            className="w-full min-h-[40px] sm:min-h-[42px] py-2 px-3 rounded-xl bg-[#22A39E] hover:bg-[#1b8581] active:scale-[0.99] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs hover:shadow-sm cursor-pointer select-none"
          >
            <span>اطلب الآن</span>
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
