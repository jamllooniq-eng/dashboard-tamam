import React from 'react';
import { Truck, ShieldCheck, CheckCircle2, Zap } from 'lucide-react';

interface HeroProps {
  onExploreClick?: () => void;
}

export const Hero: React.FC<HeroProps> = () => {
  return (
    <section
      id="hero-section"
      className="bg-gradient-to-b from-gray-50/80 to-white border-b border-gray-100 py-4 sm:py-5"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 bg-white border border-gray-200/80 rounded-2xl p-3.5 sm:p-4 shadow-xs">
          {/* Main Title & Notice */}
          <div className="flex items-center gap-3 text-right">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#22A39E]/10 flex items-center justify-center text-[#22A39E] shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-gray-900 leading-tight">
                متجر المنتجات الذكية والمبتكرة
              </h1>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                تصفح واطلب مباشرة بدون سلة أو تسجيل مع الشحن المجاني لكافة المحافظات
              </p>
            </div>
          </div>

          {/* Quick Trust Highlights in one compact row */}
          <div className="flex items-center gap-2 sm:gap-4 text-xs font-semibold text-gray-700 w-full md:w-auto justify-between md:justify-end pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
              <Truck className="w-3.5 h-3.5 text-[#22A39E]" />
              <span className="text-[11px] sm:text-xs">توصيل مجاني 100%</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
              <ShieldCheck className="w-3.5 h-3.5 text-[#22A39E]" />
              <span className="text-[11px] sm:text-xs">فحص قبل الاستلام</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#22A39E]" />
              <span className="text-[11px] sm:text-xs">دفع عند الباب</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
