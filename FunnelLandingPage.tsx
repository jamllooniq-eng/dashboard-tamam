import React from 'react';
import { RolemallProduct, OrderResult, PolicyType } from '../../types';
import { FunnelHeader } from './FunnelHeader';
import { FunnelSteps } from './FunnelSteps';
import { ProductGallery } from './ProductGallery';
import { ProductDetailsBox } from './ProductDetailsBox';
import { ProductFAQ } from './ProductFAQ';
import { StickyBottomBar } from './StickyBottomBar';
import { OrderForm } from '../order/OrderForm';
import { 
  Truck, 
  ShieldCheck, 
  Sparkles, 
  ShoppingBag,
  RefreshCw,
  Banknote,
  CheckCircle2,
  Headphones,
  Heart
} from 'lucide-react';

interface FunnelLandingPageProps {
  product: RolemallProduct;
  allProducts?: RolemallProduct[];
  onBackToHome: () => void;
  onSelectProduct?: (product: RolemallProduct) => void;
  onOrderSuccess: (
    result: OrderResult,
    orderDetails: {
      product: RolemallProduct;
      quantity: number;
      name: string;
      phone: string;
      governorate: string;
      address: string;
      totalPrice: number;
    }
  ) => void;
  onOpenPolicy: (type: PolicyType) => void;
}

export const FunnelLandingPage: React.FC<FunnelLandingPageProps> = ({
  product,
  allProducts,
  onBackToHome,
  onSelectProduct,
  onOrderSuccess,
  onOpenPolicy,
}) => {
  // NOTE: OrderForm renders exactly ONCE in the DOM (single instance,
  // repositioned via CSS Grid `order` between mobile and desktop), so its
  // internal id="order-form-card" is never duplicated. A plain
  // getElementById lookup is sufficient and reliable.
  const scrollToOrder = () => {
    const formElement = document.getElementById('order-form-card') || document.getElementById('order-form-container');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const discountAmount = product.old_price && product.old_price > product.price
    ? product.old_price - product.price
    : null;

  const discountPercentage = product.old_price && product.old_price > product.price
    ? Math.round(((product.old_price - product.price) / product.old_price) * 100)
    : null;

  return (
    <div className="min-h-screen bg-white text-black font-['Cairo',sans-serif] flex flex-col selection:bg-[#22A39E] selection:text-white">
      {/* 1. High-Converting Funnel Minimal Header */}
      <FunnelHeader onScrollToOrder={scrollToOrder} />

      {/* Main Funnel Landing Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl lg:max-w-6xl mx-auto px-3 sm:px-6 pt-4 pb-6 sm:pt-5 sm:pb-8 space-y-6 sm:space-y-8 min-w-0">

          {/* Unified Responsive Grid — single source of truth for both Mobile
              and Desktop layouts.

              DELIBERATE DESIGN CHOICE: the grid has only TWO real top-level
              items in its first "row" (the main content block and the
              OrderForm), not five separate items each with their own
              row-start/row-end. Grouping price + gallery + details back
              into ONE wrapper (exactly like the original, pre-merge
              design) means that single wrapper's height is driven purely
              by its own content, completely independent of the form.
              With only two siblings sharing one implicit row and
              `items-start` (no stretch), the row's height is simply
              `max(main content height, form height)` — no explicit
              row-span/row-end arithmetic needed at all, and no risk of
              one item's height inflating a row that pushes the other
              item down. This is the standard, lowest-risk CSS Grid
              pattern for a "main column + sticky sidebar" layout. */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-2.5 lg:gap-8 lg:items-start min-w-0">

            {/* MAIN COLUMN — price banner, gallery, and details box, stacked
                in normal document flow (not as separate grid items). Same
                internal order and spacing on both Mobile and Desktop. */}
            <div className="order-1 lg:order-1 lg:col-span-7 space-y-2 sm:space-y-2.5 min-w-0">

              {/* Price & Delivery Banner */}
              <div className="rounded-2xl bg-gradient-to-l from-[#22A39E]/[0.07] via-white to-[#22A39E]/[0.07] border-2 border-[#22A39E]/30 p-3 sm:px-5 sm:py-3.5 shadow-xs transition-all hover:border-[#22A39E]/50">
                <div className="flex items-center justify-between gap-3 sm:gap-6 flex-nowrap min-w-0">
                  {/* Price Section */}
                  <div className="flex items-baseline gap-1.5 sm:gap-2 shrink-0">
                    <span className="text-xs sm:text-sm font-extrabold text-gray-700">السعر:</span>
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-[#177773] tracking-tight drop-shadow-2xs">
                      {product.price.toLocaleString('en-US')}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-gray-600 mr-0.5">
                      د.ع
                    </span>
                    {product.old_price && product.old_price > product.price && (
                      <span className="text-xs sm:text-sm text-gray-400 line-through mr-1.5 font-medium">
                        {product.old_price.toLocaleString('en-US')}
                      </span>
                    )}
                  </div>

                  {/* Badges Section (Delivery + Discount) */}
                  <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                    {discountPercentage && (
                      <span className="inline-flex items-center bg-[#22A39E] text-white text-[11px] sm:text-xs font-black px-2.5 py-1 rounded-xl shadow-2xs">
                        خصم {discountPercentage}%
                      </span>
                    )}
                    <div className="inline-flex items-center gap-1.5 bg-[#22A39E]/15 border border-[#22A39E]/30 text-[#177773] text-xs sm:text-sm font-black px-3 py-1.5 rounded-xl shadow-2xs">
                      <Truck className="w-4 h-4 text-[#22A39E] shrink-0" />
                      <span>توصيل مجاني</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gallery */}
              <ProductGallery
                images={product.images}
                mainImage={product.image}
                title={product.title}
              />

              {/* MOBILE ONLY: Title + Trust Badges right after the image */}
              <div className="lg:hidden">
                <ProductDetailsBox
                  title={product.title}
                  description={product.description}
                  features={product.features}
                  variant="header"
                />
              </div>

              {/* DESKTOP: Full Product Details Box (title + badges + description) */}
              <div className="hidden lg:block">
                <ProductDetailsBox
                  title={product.title}
                  description={product.description}
                  features={product.features}
                  variant="full"
                />
              </div>
            </div>

            {/* ORDER FORM — SINGLE instance in the DOM.
                Mobile: flows in-place right after the main column (order-2).
                Desktop: naturally lands in the remaining 5 columns of the
                same row (auto-placement — no explicit lg:col-start needed,
                since the main column above already claims columns 1–7,
                leaving exactly 5 free columns for this item to fill).
                lg:sticky keeps it pinned while the main column scrolls
                past it, exactly like the original design. */}
            <div
              id="order-form-container"
              className="order-2 lg:order-2 lg:col-span-5 lg:sticky lg:top-4 min-w-0"
            >
              <OrderForm
                product={product}
                onOrderSuccess={onOrderSuccess}
              />
            </div>

            {/* MOBILE ONLY: Description body below the order form.
                Desktop already shows the full description inside the
                "full" ProductDetailsBox in the main column above, so this
                stays lg:hidden to avoid rendering the description twice. */}
            <div className="order-3 lg:hidden min-w-0">
              <ProductDetailsBox
                description={product.description}
                features={product.features}
                variant="body"
              />
            </div>

          </div>

          {/* Section 3: 3-Steps Order Guide (Full Width Below Grid) */}
          <div className="min-w-0">
            <FunnelSteps />
          </div>

          {/* Section 4: FAQ Accordion (Full Width Below Grid) */}
          <div className="max-w-3xl mx-auto min-w-0">
            <div className="text-center mb-6 min-w-0">
              <h2 className="text-lg sm:text-2xl font-extrabold text-black break-words">
                الأسئلة الشائعة حول الطلب والتوصيل
              </h2>
            </div>
            <ProductFAQ />
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom CTA */}
      <StickyBottomBar
        productTitle={product.title}
        totalPrice={product.price}
        onScrollToOrder={scrollToOrder}
      />

      {/* Balanced, Clean & Concise Funnel Footer */}
      <footer id="funnel-footer" className="bg-gray-50/90 border-t border-gray-200/80 pt-8 pb-28 md:pb-10 mt-12 text-gray-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {/* Top Row: Brand & Quick Trust Badges in a centered, balanced layout */}
          <div className="flex flex-col items-center justify-center gap-5 pb-5 border-b border-gray-200/70 text-center">
            {/* Brand (English Only, Centered & Stylized) */}
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex flex-col items-center justify-center cursor-pointer group focus:outline-none transition-all active:scale-98 text-center"
              title="TAMAM SHOP - العودة للرئيسية"
            >
              <span className="font-black text-2xl sm:text-3xl tracking-[0.18em] text-gray-900 group-hover:text-[#22A39E] transition-colors uppercase font-sans">
                TAMAM <span className="text-[#22A39E]">SHOP</span>
              </span>
              <span className="text-[11px] text-gray-400 font-medium mt-1">تسوق موثوق ومباشر في العراق 🇮🇶</span>
            </button>

            {/* Concise Trust Badges */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-center text-xs text-gray-700">
              <div className="flex items-center gap-1.5 bg-white border border-gray-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
                <Truck className="w-3.5 h-3.5 text-[#22A39E]" />
                <span className="font-semibold text-xs">توصيل سريع</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-gray-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold text-xs">معاينة قبل الدفع</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-gray-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
                <Banknote className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-semibold text-xs">دفع عند الاستلام</span>
              </div>
            </div>
          </div>

          {/* Middle Row: Policy Navigation */}
          <div className="py-3.5 flex items-center justify-center gap-2 sm:gap-4 flex-wrap text-xs text-gray-500 font-medium">
            <button
              type="button"
              onClick={() => onOpenPolicy('about')}
              className="hover:text-[#22A39E] transition-colors cursor-pointer py-1"
            >
              من نحن
            </button>
            <span className="text-gray-300 select-none">•</span>
            <button
              type="button"
              onClick={() => onOpenPolicy('returns')}
              className="hover:text-[#22A39E] transition-colors cursor-pointer py-1"
            >
              سياسة الاسترجاع والاستبدال
            </button>
            <span className="text-gray-300 select-none">•</span>
            <button
              type="button"
              onClick={() => onOpenPolicy('terms')}
              className="hover:text-[#22A39E] transition-colors cursor-pointer py-1"
            >
              الشروط والأحكام
            </button>
            <span className="text-gray-300 select-none">•</span>
            <button
              type="button"
              onClick={() => onOpenPolicy('privacy')}
              className="hover:text-[#22A39E] transition-colors cursor-pointer py-1"
            >
              سياسة الخصوصية
            </button>
          </div>

          {/* Bottom Copyright & Guarantee note */}
          <div className="pt-3 border-t border-gray-200/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-gray-400 text-center sm:text-right">
            <p>جميع الحقوق محفوظة © {new Date().getFullYear()} <span className="text-gray-600 font-semibold">تمام شوب</span></p>
            <p className="flex items-center justify-center gap-1.5 text-gray-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>تسوق آمن ومباشر 100% في العراق</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
