import React from 'react';
import { RotateCw, Home, RefreshCcw } from 'lucide-react';
import { TopBar } from './layout/TopBar';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';
import { PolicyType } from '../types';

interface ProductUnavailableViewProps {
  onBackToHome: () => void;
  onOpenPolicy?: (type: PolicyType) => void;
}

export const ProductUnavailableView: React.FC<ProductUnavailableViewProps> = ({
  onBackToHome,
  onOpenPolicy,
}) => {
  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

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

      {/* 3. Unavailable Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-16 sm:py-24">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Icon Badge */}
          <div className="w-24 h-24 mx-auto rounded-3xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-xs">
            <RefreshCcw className="w-11 h-11 stroke-[1.75]" />
          </div>

          {/* Heading and Description */}
          <div className="space-y-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              تعذّر تحميل هذا المنتج حالياً
            </h1>
            <p className="text-sm sm:text-base text-gray-600 font-medium leading-relaxed max-w-sm mx-auto">
              قد يكون هناك ضغط مؤقت على الخادم. يرجى تحديث الصفحة خلال لحظات.
            </p>
          </div>

          {/* Status code pill */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>انقطاع مؤقت</span>
            <span>•</span>
            <span>يرجى إعادة المحاولة</span>
          </div>

          {/* CTA Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleReload}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#22A39E] hover:bg-[#1b8581] text-white font-extrabold text-sm shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-95"
            >
              <RotateCw className="w-4 h-4" />
              <span>إعادة تحميل الصفحة</span>
            </button>
            <button
              type="button"
              onClick={onBackToHome}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#F7F7F7] hover:bg-gray-200 border border-[#E5E5E5] text-gray-800 font-bold text-sm transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4 text-gray-500" />
              <span>العودة للرئيسية</span>
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
