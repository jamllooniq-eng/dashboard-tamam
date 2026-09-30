import React from 'react';
import { RolemallProduct } from '../../types';
import {
  CheckCircle2,
  Truck,
  AlertTriangle,
  ShoppingBag,
  PackageCheck,
} from 'lucide-react';
import { getOptimizedImageUrl } from '../../lib/image';

interface SuccessViewProps {
  orderId?: string;
  orderDetails: {
    product: RolemallProduct;
    quantity: number;
    name: string;
    phone: string;
    governorate: string;
    address: string;
    totalPrice: number;
  };
  onContinueShopping?: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({
  orderDetails,
}) => {
  const { product, quantity, totalPrice, name, phone, governorate, address } = orderDetails;

  const imageUrl = product.image
    ? getOptimizedImageUrl(product.image, { width: 300, quality: 85, fit: 'contain' })
    : '';

  return (
    <div id="order-success-container" className="py-8 sm:py-12 px-4 sm:px-6 max-w-2xl mx-auto">
      {/* Main Success Container */}
      <div className="bg-white border border-gray-200/90 rounded-3xl p-5 sm:p-8 shadow-xl shadow-gray-200/40 space-y-6">

        {/* 1. Success Hero Header */}
        <div className="text-center space-y-3">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/10 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 stroke-[2.2]" />
            </div>
            <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-1 border-2 border-white shadow-xs">
              <PackageCheck className="w-4 h-4" />
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
              تم استلام طلبك بنجاح!
            </h1>
          </div>
        </div>

        {/* 2. WhatsApp Confirmation Alert Banner */}
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 sm:p-4 text-center">
          <p className="text-sm sm:text-base font-semibold text-gray-900 leading-relaxed max-w-lg mx-auto">
            سيتم التواصل معك قريباً لتأكيد الطلب، الرجاء الرد على رسالة الواتساب بكلمة{' '}
            <strong className="text-emerald-700 font-black text-sm sm:text-base">
              «تم»
            </strong>
          </p>
        </div>

        {/* 3. Product Card with High-Res Image & Full Order Details */}
        <div className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-4 sm:p-4.5 space-y-3.5 shadow-2xs">
          {/* Card Header: Details Title */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 pb-2 border-b border-gray-200/60">
            <ShoppingBag className="w-3.5 h-3.5 text-[#22A39E]" />
            <span>تفاصيل الطلب</span>
          </div>

          {/* Product Header Row: Image + Title & Count */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl bg-white border border-gray-200/80 p-1.5 shrink-0 overflow-hidden flex items-center justify-center shadow-2xs">
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
                <div className="text-[10px] font-bold text-[#22A39E] flex flex-col items-center">
                  <ShoppingBag className="w-5 h-5 mb-0.5 opacity-40" />
                  <span>تمام شوب</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 line-clamp-2 leading-relaxed">
                {product.title}
              </h3>
              <div className="inline-flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-0.5 rounded-md text-xs font-bold text-gray-700 shadow-2xs">
                <span>العدد:</span>
                <span className="text-gray-900">{quantity}</span>
              </div>
            </div>
          </div>

          {/* Customer & Delivery Details Rows */}
          <div className="pt-3 border-t border-gray-200/70 space-y-2.5 text-sm text-gray-700">
            <div className="flex justify-between items-start gap-3 min-w-0">
              <span className="text-gray-500 font-medium shrink-0">المستلم:</span>
              <span className="font-bold text-gray-900 break-words text-left min-w-0">{name}</span>
            </div>
            <div className="flex justify-between items-center gap-3 min-w-0">
              <span className="text-gray-500 font-medium shrink-0">رقم الهاتف:</span>
              <span className="font-mono font-bold text-gray-900 shrink-0" dir="ltr">{phone}</span>
            </div>
            <div className="flex justify-between items-start gap-3 min-w-0">
              <span className="text-gray-500 font-medium shrink-0">عنوان التوصيل:</span>
              <span className="font-bold text-gray-900 break-words text-left min-w-0">{governorate} - {address}</span>
            </div>
          </div>

          {/* Pricing & Free Delivery Footer Row: Price on Right (RTL), Free Delivery on Left */}
          <div className="pt-3 border-t border-gray-200/80 flex items-center justify-between gap-3">
            {/* Right side (RTL first child): Total Price (Number + Currency) */}
            <div className="flex items-baseline gap-1 text-gray-900">
              <span className="text-[#22A39E] text-lg sm:text-xl font-black tracking-tight">
                {totalPrice.toLocaleString('en-US')}
              </span>
              <span className="text-xs font-bold text-gray-700">د.ع</span>
            </div>

            {/* Left side (RTL second child): Free Delivery Badge */}
            <div className="inline-flex items-center gap-1.5 text-[#22A39E] text-xs sm:text-sm font-bold">
              <Truck className="w-4 h-4 text-[#22A39E] shrink-0" />
              <span>توصيل مجاني</span>
            </div>
          </div>
        </div>

        {/* 4. Warning Banner */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-950 flex items-center justify-center gap-2.5 text-xs sm:text-sm font-semibold shadow-2xs">
          <AlertTriangle className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-600 shrink-0" />
          <span>يرجى فحص المنتج قبل الاستلام للتأكد من سلامته</span>
        </div>

      </div>
    </div>
  );
};
