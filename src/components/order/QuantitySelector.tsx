import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface QuantitySelectorProps {
  quantity: number;
  onChange: (qty: number) => void;
  min?: number;
  max?: number;
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  onChange,
  min = 1,
  max = 50,
}) => {
  const handleDecrement = () => {
    if (quantity > min) {
      onChange(quantity - 1);
    }
  };

  const handleIncrement = () => {
    if (quantity < max) {
      onChange(quantity + 1);
    }
  };

  return (
    <div
      dir="ltr"
      className="inline-flex items-center gap-1.5 sm:gap-2 p-1 rounded-xl bg-gray-100/90 border border-gray-200/90 shadow-inner shrink-0"
    >
      <button
        type="button"
        id="qty-increment-btn"
        onClick={handleIncrement}
        disabled={quantity >= max}
        aria-label="زيادة العدد"
        className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-white text-gray-800 font-bold shadow-xs hover:bg-gray-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer border border-gray-200/60"
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
      </button>

      <span className="w-7 sm:w-8 text-center text-sm sm:text-base font-black text-gray-900 select-none">
        {quantity}
      </span>

      <button
        type="button"
        id="qty-decrement-btn"
        onClick={handleDecrement}
        disabled={quantity <= min}
        aria-label="تقليل العدد"
        className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-white text-gray-800 font-bold shadow-xs hover:bg-gray-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer border border-gray-200/60"
      >
        <Minus className="w-4 h-4 stroke-[2.5]" />
      </button>
    </div>
  );
};

