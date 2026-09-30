import React from 'react';
import { PackageX, SearchX, ArrowRight, Home } from 'lucide-react';
import { TopBar } from './layout/TopBar';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';
import { PolicyType } from '../types';

interface NotFoundViewProps {
  type?: 'product' | 'page';
  onBackToHome: () => void;
  onOpenPolicy?: (type: PolicyType) => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  type = 'page',
  onBackToHome,
  onOpenPolicy,
}) => {
  const isProduct = type === 'product';

  return (
    <div className="min-h-screen flex flex-col bg-white text-black font-['Cairo',sans-serif]">
      {/* 1. Top Announcement Bar */}
      <TopBar />

      {/* 2. Main Store Header */}
      <Header
        searchQuery=""
        onSearchChange={() => {}}
        onResetToHome={onBackToHome}
      />

      {/* 3. Not Found Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-16 sm:py-24">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Icon Badge */}
          <div className="w-24 h-24 mx-auto rounded-3xl bg-[#F7F7F7] border border-[#E5E5E5] flex items-center justify-center text-[#22A39E] shadow-xs">
            {isProduct ? (
              <PackageX className="w-12 h-12 stroke-[1.5]" />
            ) : (
              <SearchX className="w-12 h-12 stroke-[1.5]" />
            )}
          </div>

          {/* Heading and Description */}
          <div className="space-y-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              {isProduct ? 'المنتج غير موجود' : 'الصفحة غير موجودة'}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 font-medium leading-relaxed max-w-sm mx-auto">
              {isProduct
                ? 'عذراً، المنتج الذي تبحث عنه غير متوفر حالياً، قد يكون نفد من المخزون أو تم تغيير رابطه.'
                : 'عذراً، الرابط الذي تحاول الوصول إليه غير صحيح أو تم نقله.'}
            </p>
          </div>

          {/* Status code pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs font-bold text-gray-500">
            <span>خطأ 404</span>
            <span>•</span>
            <span>{isProduct ? 'Product Not Found' : 'Page Not Found'}</span>
          </div>

          {/* CTA Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#22A39E] hover:bg-[#1b8581] text-white font-extrabold text-sm shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-95"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للمتجر</span>
            </button>
            <button
              type="button"
              onClick={onBackToHome}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#F7F7F7] hover:bg-gray-200 border border-[#E5E5E5] text-gray-800 font-bold text-sm transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4 text-gray-500" />
              <span>تصفح جميع المنتجات</span>
            </button>
          </div>
        </div>
      </main>

      {/* 4. Footer */}
      <Footer
        onOpenPolicy={(policy) => onOpenPolicy?.(policy)}
        onResetToHome={onBackToHome}
      />
    </div>
  );
};
