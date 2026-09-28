import React from 'react';
import { ShoppingBag, ShieldCheck, Truck, Clock, RefreshCw } from 'lucide-react';
import { PolicyType } from '../../types';

interface FooterProps {
  onOpenPolicy: (type: PolicyType) => void;
  onSelectCategory?: (categoryId: string) => void;
  onResetToHome?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenPolicy,
  onSelectCategory,
  onResetToHome,
}) => {
  return (
    <footer id="main-footer" className="bg-white border-t border-[#E5E5E5] pt-12 pb-24 md:pb-8 mt-16 text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Store Info */}
          <div className="md:col-span-1 space-y-3">
            <button
              type="button"
              onClick={onResetToHome}
              className="flex items-center gap-2 cursor-pointer text-right group focus:outline-none transition-all"
              title="العودة للرئيسية"
            >
              <div className="w-8 h-8 rounded-lg bg-[#22A39E] text-white flex items-center justify-center transition-transform group-hover:scale-105">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold group-hover:text-[#22A39E] transition-colors">تمام شوب</span>
            </button>
            <p className="text-xs text-gray-600 leading-relaxed">
              متجرك الموثوق في العراق لأفضل المنتجات والأجهزة المبتكرة. تجربة تسوق مباشرة، سريعة، وبدون تعقيد مع ضمان المعاينة قبل الدفع.
            </p>
            <div className="pt-2 text-xs text-gray-500 font-medium">
              توصيل لجميع محافظات العراق الـ 18
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-bold text-black mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22A39E]"></span>
              <span>روابط سريعة</span>
            </h3>
            <ul className="space-y-2 text-xs text-gray-600">
              <li>
                <button
                  type="button"
                  onClick={onResetToHome}
                  className="hover:text-[#22A39E] transition-colors cursor-pointer"
                >
                  الرئيسية
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectCategory) {
                      onSelectCategory('');
                    } else if (onResetToHome) {
                      onResetToHome();
                    }
                    if (typeof document !== 'undefined') {
                      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="hover:text-[#22A39E] transition-colors cursor-pointer"
                >
                  جميع المنتجات
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPolicy('about')}
                  className="hover:text-[#22A39E] transition-colors cursor-pointer"
                >
                  من نحن
                </button>
              </li>
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h3 className="text-sm font-bold text-black mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22A39E]"></span>
              <span>السياسات والضمان</span>
            </h3>
            <ul className="space-y-2 text-xs text-gray-600">
              <li>
                <button
                  onClick={() => onOpenPolicy('returns')}
                  className="hover:text-[#22A39E] transition-colors cursor-pointer"
                >
                  الاستبدال والاسترجاع
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenPolicy('privacy')}
                  className="hover:text-[#22A39E] transition-colors cursor-pointer"
                >
                  سياسة الخصوصية
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenPolicy('terms')}
                  className="hover:text-[#22A39E] transition-colors cursor-pointer"
                >
                  الشروط والأحكام
                </button>
              </li>
            </ul>
          </div>

          {/* Guarantees */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-black mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22A39E]"></span>
              <span>ضمانات المتجر</span>
            </h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#22A39E] shrink-0" />
                <span>شحن مجاني لكل المحافظات</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#22A39E] shrink-0" />
                <span>الدفع عند الاستلام والمعاينة</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#22A39E] shrink-0" />
                <span>استبدال فوري عند وجود عيب مصنعي</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#22A39E] shrink-0" />
                <span>معالجة وتجهيز فوري للطلبات</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="border-t border-[#E5E5E5] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>
            © {new Date().getFullYear()}{' '}
            <button
              type="button"
              onClick={onResetToHome}
              className="font-semibold text-gray-700 hover:text-[#22A39E] transition-colors cursor-pointer"
            >
              تمام شوب (TAMAM Shop)
            </button>
            . جميع الحقوق محفوظة.
          </p>
          <p className="flex items-center gap-1">
            <span>تسوق آمن ومباشر</span>
            <span className="text-[#22A39E] font-bold">100%</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
