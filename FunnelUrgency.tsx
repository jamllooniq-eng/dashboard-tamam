import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface FunnelUrgencyProps {
  stock?: number;
  available?: boolean;
}

export const FunnelUrgency: React.FC<FunnelUrgencyProps> = ({ stock, available = true }) => {
  const isOutOfStock = available === false || (stock !== undefined && stock <= 0);

  return (
    <div className="space-y-2">
      {/* Real Stock / Availability Bar */}
      <div className="flex items-center justify-between gap-2 text-xs text-gray-600 px-1">
        {isOutOfStock ? (
          <div className="flex items-center gap-1.5 font-bold text-red-600">
            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>المنتج غير متوفر حالياً بالمخزن</span>
          </div>
        ) : stock !== undefined && stock > 0 ? (
          <div className="flex items-center gap-1.5 font-medium text-amber-800">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>متبقي <strong>{stock} قطع</strong> في المخزن</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 font-medium text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span><strong>متوفر في المخزن</strong> — جاهز للشحن الفوري</span>
          </div>
        )}
      </div>

      {/* Visual Indicator */}
      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            isOutOfStock ? 'bg-red-400 w-full' : 'bg-[#22A39E] w-full'
          }`}
        />
      </div>
    </div>
  );
};


