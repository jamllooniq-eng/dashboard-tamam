import React, { useState } from 'react';
import { RolemallProduct, OrderResult } from '../../types';
import { IRAQ_GOVERNORATES } from '../../lib/governorates';
import { normalizeDigits, normalizeIraqiPhone } from '../../lib/phone';
import { QuantitySelector } from './QuantitySelector';
import { trackInitiateCheckout, trackPurchase, getMetaCookies } from '../../lib/meta-pixel.client';
import { User, Phone, MapPin, AlertCircle, Loader2, Send, Truck, ChevronDown, ShieldCheck } from 'lucide-react';

interface OrderFormProps {
  product: RolemallProduct;
  onOrderSuccess: (result: OrderResult, orderDetails: {
    product: RolemallProduct;
    quantity: number;
    name: string;
    phone: string;
    governorate: string;
    address: string;
    totalPrice: number;
  }) => void;
}

// ⚠️ لا تُغيّر هذا لـ text-sm أو أي حجم متغيّر حسب الشاشة — حجم أقل من 16px يُفعّل تكبير الشاشة التلقائي بـ Safari على آيفون عند لمس الحقل
const INPUT_TEXT_SIZE = 'text-base';

export const OrderForm: React.FC<OrderFormProps> = ({
  product,
  onOrderSuccess,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [governorate, setGovernorate] = useState<string>('');
  const [address, setAddress] = useState('');

  const [hasInteracted, setHasInteracted] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputFocus = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      trackInitiateCheckout({
        id: product.id,
        title: product.title,
        price: product.price,
        count: quantity,
      });
    }
  };

  const handlePhoneBlur = () => {
    if (phone.trim()) {
      const check = normalizeIraqiPhone(phone);
      if (!check.isValid) {
        setPhoneError(check.error || 'رقم الهاتف غير صحيح');
      } else {
        setPhoneError(null);
        setPhone(check.normalized);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Client-side quick checks
    if (name.trim().length < 2) {
      setSubmitError('يرجى إدخال الاسم الكامل (حرفين على الأقل)');
      return;
    }

    const phoneCheck = normalizeIraqiPhone(phone);
    if (!phoneCheck.isValid) {
      setPhoneError(phoneCheck.error || 'رقم الهاتف غير صحيح');
      setSubmitError(phoneCheck.error || 'يرجى إدخال رقم هاتف عراقي صالح يبدأ بـ 07');
      return;
    }

    if (!governorate || governorate.trim() === '') {
      setSubmitError('يرجى اختيار المحافظة لتحديد مسار التوصيل');
      return;
    }

    if (address.trim().length < 3) {
      setSubmitError('يرجى كتابة العنوان التفصيلي (المنطقة / المحلة / أقرب نقطة دالة)');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Generate client-side Order ID for instant UI rendering and tracking
      const clientOrderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { fbp, fbc } = getMetaCookies();

      const payload = {
        orderId: clientOrderId,
        cus_name: name.trim(),
        cus_num1: phoneCheck.normalized,
        capetel: governorate,
        address: address.trim(),
        item_id: product.id,
        product_name: product.title,
        unit_price: product.price,
        count: quantity,
        all_price: product.price * quantity,
        fbp: fbp || undefined,
        fbc: fbc || undefined,
      };

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: OrderResult = await res.json();

      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً');
        setIsSubmitting(false);
        return;
      }

      const finalOrderId = data.orderId || clientOrderId;

      // Track Purchase in Meta Pixel with Advanced Matching and exact event_id
      trackPurchase({
        orderId: finalOrderId,
        productId: product.id,
        productName: product.title,
        totalPrice: product.price * quantity,
        count: quantity,
        customerName: name.trim(),
        phone: phoneCheck.normalized,
      });

      onOrderSuccess({ ...data, orderId: finalOrderId }, {
        product,
        quantity,
        name: name.trim(),
        phone: phoneCheck.normalized,
        governorate,
        address: address.trim(),
        totalPrice: product.price * quantity,
      });
    } catch {
      setSubmitError('فشل الاتصال بالخادم، يرجى التأكد من اتصال الإنترنت والمحاولة ثانية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="order-form-card"
      className="scroll-mt-4 bg-white border border-[#22A39E]/40 sm:border-2 sm:border-[#22A39E]/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl shadow-[#22A39E]/5 relative overflow-hidden ring-2 sm:ring-4 ring-[#22A39E]/10"
    >
      {/* Accent Top Gradient Header Bar */}
      <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-[#22A39E] via-[#2ec4be] to-[#22A39E]"></div>

      {/* Header section inside card — side accent bar + two-tone heading (agreed final design) */}
      <div className="mb-4 sm:mb-5 text-right min-w-0">
        <div className="flex items-center justify-start gap-3">
          <span className="h-7 w-1 shrink-0 rounded-full bg-[#22A39E]" />
          <h3 className="text-base sm:text-lg font-extrabold leading-tight tracking-tight text-[#172033]">
            يرجى إدخال <span className="text-[#22A39E]">معلوماتك</span> لإكمال الطلب
          </h3>
        </div>
        <div className="mt-3 h-px w-full bg-gradient-to-l from-gray-100 via-gray-100 to-transparent" />
      </div>

      {/* Quantity Selector & Order Total Price Rows (Quantity first, Total underneath) */}
      <div className="space-y-2.5 mb-4 sm:mb-5 min-w-0">
        {/* Quantity Selector Card (Above Total Price) */}
        <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gray-50/90 hover:bg-gray-50 border-2 border-gray-200/90 flex items-center justify-between shadow-2xs transition-colors gap-2 min-w-0">
          <span className="text-sm sm:text-base font-extrabold text-gray-900 select-none pr-1">
            عدد القطع
          </span>
          <QuantitySelector
            quantity={quantity}
            onChange={(newQty) => setQuantity(newQty)}
          />
        </div>

        {/* Order Total Price Card (Underneath Quantity) */}
        <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#22A39E]/8 border-2 border-[#22A39E]/30 flex items-center justify-between shadow-2xs gap-2 min-w-0">
          <span className="text-sm sm:text-base font-extrabold text-gray-900 select-none pr-1">
            إجمالي الطلب
          </span>
          <div className="flex items-baseline gap-1.5 text-[#178581] font-black shrink-0">
            <span className="text-base sm:text-xl md:text-2xl tracking-tight font-black">
              {(product.price * quantity).toLocaleString('en-US')}
            </span>
            <span className="text-xs sm:text-sm font-bold">د.ع</span>
          </div>
        </div>
      </div>

      {/* Submit Error Notification */}
      {submitError && (
        <div
          id="checkout-error-banner"
          className="mb-3.5 p-3.5 rounded-xl bg-red-50 border-2 border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2 shadow-2xs animate-shake"
        >
          <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed font-bold">{submitError}</div>
        </div>
      )}

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
        {/* Full Name */}
        <div className="group">
          <label htmlFor="cus_name" className="block text-xs sm:text-sm font-black text-gray-900 mb-1.5 transition-colors group-focus-within:text-[#22A39E]">
            الاسم الكامل <span className="text-[#22A39E] font-black">*</span>
          </label>
          <div className="relative">
            {/* ⚠️ لا تُغيّر text-base هنا إلى text-sm أو حجم متغيّر بالموبايل — يُفعّل تكبير الشاشة التلقائي بـ Safari/iOS */}
            <input
              id="cus_name"
              name="cus_name"
              type="text"
              required
              value={name}
              onFocus={handleInputFocus}
              onChange={(e) => setName(e.target.value)}
              placeholder="اكتب اسمك هنا"
              className={`w-full h-12 sm:h-13 bg-[#FAFAFA] hover:bg-white text-gray-900 ${INPUT_TEXT_SIZE} font-bold rounded-xl pr-11 pl-4 border-2 border-gray-300/90 focus:bg-white focus:border-[#22A39E] focus:ring-4 focus:ring-[#22A39E]/15 transition-all outline-none shadow-xs placeholder:text-gray-400 placeholder:font-normal`}
            />
            <User className="w-5 h-5 text-[#22A39E] group-focus-within:text-[#178581] transition-colors absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Phone Number */}
        <div className="group">
          <label htmlFor="cus_num1" className="block text-xs sm:text-sm font-black text-gray-900 mb-1.5 transition-colors group-focus-within:text-[#22A39E]">
            رقم الهاتف <span className="text-[#22A39E] font-black">*</span>
          </label>
          <div className="relative">
            {/* ⚠️ لا تُغيّر text-base هنا إلى text-sm أو حجم متغيّر بالموبايل — يُفعّل تكبير الشاشة التلقائي بـ Safari/iOS */}
            <input
              id="cus_num1"
              name="cus_num1"
              type="tel"
              required
              dir="ltr"
              maxLength={11}
              value={phone}
              onFocus={handleInputFocus}
              onChange={(e) => {
                const converted = normalizeDigits(e.target.value).slice(0, 11);
                setPhone(converted);
                if (phoneError) setPhoneError(null);
              }}
              onBlur={handlePhoneBlur}
              placeholder="07XXXXXXXXX"
              className={`w-full h-12 sm:h-13 text-gray-900 ${INPUT_TEXT_SIZE} font-bold rounded-xl pl-11 pr-4 border-2 transition-all outline-none font-mono shadow-xs placeholder:text-gray-400 placeholder:font-sans ${
                phoneError
                  ? 'bg-red-50/50 border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                  : 'bg-[#FAFAFA] hover:bg-white border-gray-300/90 focus:bg-white focus:border-[#22A39E] focus:ring-4 focus:ring-[#22A39E]/15'
              }`}
            />
            <Phone className={`w-5 h-5 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${phoneError ? 'text-red-500' : 'text-[#22A39E] group-focus-within:text-[#178581]'}`} />
          </div>
          {phoneError && (
            <p className="text-xs sm:text-sm text-red-600 mt-1.5 font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{phoneError}</span>
            </p>
          )}
        </div>

        {/* Governorate Select */}
        <div className="group">
          <label htmlFor="capetel" className="block text-xs sm:text-sm font-black text-gray-900 mb-1.5 transition-colors group-focus-within:text-[#22A39E]">
            المحافظة <span className="text-[#22A39E] font-black">*</span>
          </label>
          <div className="relative">
            {/* ⚠️ لا تُغيّر text-base هنا إلى text-sm أو حجم متغيّر بالموبايل — يُفعّل تكبير الشاشة التلقائي بـ Safari/iOS */}
            <select
              id="capetel"
              name="capetel"
              required
              value={governorate}
              onFocus={handleInputFocus}
              onChange={(e) => setGovernorate(e.target.value)}
              className={`w-full h-12 sm:h-13 ${INPUT_TEXT_SIZE} font-bold rounded-xl pr-11 pl-11 border-2 border-gray-300/90 hover:bg-white focus:bg-white focus:border-[#22A39E] focus:ring-4 focus:ring-[#22A39E]/15 transition-all outline-none appearance-none cursor-pointer shadow-xs ${
                governorate ? 'bg-white text-gray-900' : 'bg-[#FAFAFA] text-gray-500'
              }`}
            >
              <option value="" disabled className="text-gray-400">
                حدد المحافظة
              </option>
              {IRAQ_GOVERNORATES.map((gov) => (
                <option key={gov} value={gov} className="text-gray-900 font-bold py-1">
                  {gov}
                </option>
              ))}
            </select>
            <MapPin className="w-5 h-5 text-[#22A39E] group-focus-within:text-[#178581] transition-colors absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronDown className="w-5 h-5 text-gray-500 group-focus-within:text-[#22A39E] transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Address */}
        <div className="group">
          <label htmlFor="address" className="block text-xs sm:text-sm font-black text-gray-900 mb-1.5 transition-colors group-focus-within:text-[#22A39E]">
            العنوان بالتفصيل <span className="text-[#22A39E] font-black">*</span>
          </label>
          <div className="relative">
            {/* ⚠️ لا تُغيّر text-base هنا إلى text-sm أو حجم متغيّر بالموبايل — يُفعّل تكبير الشاشة التلقائي بـ Safari/iOS */}
            <input
              id="address"
              name="address"
              type="text"
              required
              value={address}
              onFocus={handleInputFocus}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="المدينة / المنطقة / أقرب نقطة دالة"
              className={`w-full h-12 sm:h-13 bg-[#FAFAFA] hover:bg-white text-gray-900 ${INPUT_TEXT_SIZE} font-bold rounded-xl pr-11 pl-4 border-2 border-gray-300/90 focus:bg-white focus:border-[#22A39E] focus:ring-4 focus:ring-[#22A39E]/15 transition-all outline-none shadow-xs placeholder:text-gray-400 placeholder:font-normal`}
            />
            <MapPin className="w-5 h-5 text-[#22A39E] group-focus-within:text-[#178581] transition-colors absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Big CTA Submit Button */}
        <div className="pt-2.5 sm:pt-3 space-y-2.5">
          <button
            type="submit"
            id="submit-order-btn"
            disabled={isSubmitting}
            className="w-full py-3.5 sm:py-4 px-6 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#22A39E] via-[#1f9792] to-[#1a8581] hover:from-[#1b8581] hover:to-[#166e6b] active:scale-[0.99] text-white font-black text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-md shadow-[#22A39E]/25 hover:shadow-lg hover:shadow-[#22A39E]/35 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer animate-gentle-pulse"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جارِ تأكيد وتسجيل طلبك...</span>
              </>
            ) : (
              <>
                <span>تثبيت الطلب</span>
                <Send className="w-5 h-5 -scale-x-100" />
              </>
            )}
          </button>

          {/* Under-Button Quick Info: Price on Right, Free Delivery on Left */}
          <div
            id="order-bottom-summary"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200/90 text-xs sm:text-sm font-bold text-gray-700 shadow-2xs gap-2 min-w-0"
          >
            {/* Total Price on the Right side */}
            <div className="flex items-baseline gap-1 text-gray-900 shrink-0">
              <span className="text-gray-500 text-xs font-semibold">المبلغ:</span>
              <span className="text-[#178581] font-black text-xs sm:text-sm md:text-base">
                {(product.price * quantity).toLocaleString('en-US')}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-gray-600">د.ع</span>
            </div>

            {/* Free Delivery on the Left side */}
            <div className="flex items-center gap-1.5 text-[#178581] font-black shrink-0">
              <Truck className="w-4 h-4 text-[#22A39E] shrink-0" />
              <span className="text-xs sm:text-sm">التوصيل مجاني</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default OrderForm;
