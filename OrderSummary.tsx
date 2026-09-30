import React from 'react';
import { RolemallProduct } from '../../types';
import { Truck, CheckCircle2 } from 'lucide-react';
import { getOptimizedImageUrl } from '../../lib/image';

interface OrderSummaryProps {
  product: RolemallProduct;
  quantity: number;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  product,
  quantity,
}) => {
  const totalPrice = product.price * quantity;
  const imageUrl = product.image
    ? getOptimizedImageUrl(product.image, { width: 200, quality: 80, fit: 'contain' })
    : '';

  return (
    <div id="order-summary-box" className="bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
        <h4 className="text-sm font-bold text-black flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-[#22A39E]" />
          <span>ملخص الطلب</span>
        </h4>
        <span className="text-[11px] text-[#22A39E] font-bold bg-[#22A39E]/10 px-2 py-0.5 rounded-full">
          الدفع عند الاستلام
        </span>
      </div>

      {/* Product Mini Row */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-14 h-14 rounded-lg bg-white border border-[#E5E5E5] p-1 shrink-0 overflow-hidden flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.title}
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.currentTarget;
                if (product.image && target.src !== product.image) {
                  target.src = product.image;
                }
              }}
            />
          ) : (
            <div className="text-[10px] text-gray-400">تمام شوب</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h5 className="text-xs font-bold text-black line-clamp-2 break-words mb-1">
            {product.title}
          </h5>
          <div className="text-[11px] text-gray-600 flex items-center gap-2 flex-wrap">
            <span>الكمية: <strong>{quantity}</strong></span>
            <span>•</span>
            <span>سعر الوحدة: <strong>{product.price.toLocaleString('en-US')} د.ع</strong></span>
          </div>
        </div>
      </div>

      {/* Financial Details */}
      <div className="space-y-2 pt-2 border-t border-[#E5E5E5] text-xs min-w-0">
        <div className="flex justify-between text-gray-600 gap-2 min-w-0">
          <span className="min-w-0">المجموع الفرعي:</span>
          <span className="font-semibold text-black shrink-0">
            {totalPrice.toLocaleString('en-US')} د.ع
          </span>
        </div>

        <div className="flex justify-between text-gray-600 items-center gap-2 min-w-0">
          <span className="flex items-center gap-1 min-w-0 truncate">
            <Truck className="w-3.5 h-3.5 text-[#22A39E] shrink-0" />
            <span className="truncate">رسوم الشحن:</span>
          </span>
          <span className="text-[#22A39E] font-bold shrink-0">
            مجاني (0 د.ع)
          </span>
        </div>

        <div className="flex justify-between items-baseline pt-2 border-t border-[#E5E5E5] gap-2 min-w-0">
          <span className="text-xs sm:text-sm font-bold text-black min-w-0">المبلغ الإجمالي:</span>
          <div className="text-left shrink-0">
            <span className="text-base sm:text-xl font-extrabold text-[#22A39E]">
              {totalPrice.toLocaleString('en-US')}
            </span>
            <span className="text-xs font-bold text-gray-700 mr-1">د.ع</span>
          </div>
        </div>
      </div>
    </div>
  );
};
