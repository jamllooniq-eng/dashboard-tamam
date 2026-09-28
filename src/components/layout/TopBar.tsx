import React from 'react';
import { Truck, ChevronRight, ChevronLeft } from 'lucide-react';

export const TopBar: React.FC = () => {
  return (
    <div id="top-announcement-bar" className="bg-[#22A39E] text-white text-xs sm:text-sm font-bold py-2.5 px-4 select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-1.5 sm:gap-2">
        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/90 animate-nudge-right shrink-0" />
        <Truck className="w-4 h-4 shrink-0" />
        <span>توصيل خلال يوم لكل المحافظات</span>
        <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/90 animate-nudge-left shrink-0" />
      </div>
    </div>
  );
};

