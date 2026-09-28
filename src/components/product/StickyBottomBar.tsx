import React, { useState, useEffect } from 'react';

interface StickyBottomBarProps {
  productTitle: string;
  totalPrice: number;
  onScrollToOrder: () => void;
}

export const StickyBottomBar: React.FC<StickyBottomBarProps> = ({
  onScrollToOrder,
}) => {
  const [isOrderFormVisible, setIsOrderFormVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById('order-form-container');
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsOrderFormVisible(entry.isIntersecting);
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      id="sticky-mobile-order-bar"
      className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#E5E5E5] px-4 py-2.5 shadow-lg flex items-center justify-center transition-all duration-300 transform ${
        isOrderFormVisible
          ? 'translate-y-full opacity-0 pointer-events-none'
          : 'translate-y-0 opacity-100'
      }`}
    >
      <button
        id="sticky-order-btn"
        onClick={onScrollToOrder}
        className="w-full max-w-sm py-3 rounded-xl bg-[#22A39E] hover:bg-[#1b8581] active:scale-[0.99] text-white text-base font-extrabold flex items-center justify-center shadow-md cursor-pointer transition-all"
      >
        <span>اطلب الآن</span>
      </button>
    </div>
  );
};
