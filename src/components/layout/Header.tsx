import React, { useState } from 'react';
import { Search, ShoppingBag, PhoneCall, X } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onResetToHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onResetToHome,
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(localSearch.trim());
    const productsSection = document.getElementById('products');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleClear = () => {
    setLocalSearch('');
    onSearchChange('');
  };

  return (
    <header id="main-header" className="sticky top-0 z-40 bg-white border-b border-[#E5E5E5] shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2.5 sm:gap-4">
        {/* Brand Logo */}
        <button
          id="brand-logo-btn"
          onClick={onResetToHome}
          className="flex items-center gap-2 sm:gap-2.5 text-right cursor-pointer group shrink-0 focus:outline-none"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#22A39E]/10 flex items-center justify-center text-[#22A39E] group-hover:bg-[#22A39E] group-hover:text-white transition-colors duration-200 shrink-0">
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-base sm:text-xl md:text-2xl font-bold tracking-tight text-black">
                تمام شوب
              </span>
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#22A39E] inline-block mb-1"></span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-gray-500 font-medium block -mt-1 uppercase">
              TAMAM Shop
            </span>
          </div>
        </button>

        {/* Search Bar */}
        <form
          id="global-search-form"
          onSubmit={handleSubmit}
          className="flex-1 min-w-0 max-w-xl relative"
        >
          <div className="relative flex items-center group">
            <input
              id="search-input"
              type="text"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                if (e.target.value === '') {
                  onSearchChange('');
                }
              }}
              placeholder="عن ماذا تبحث؟ (ساعة، سماعة...)"
              className="w-full bg-[#F8F9FA] text-gray-900 placeholder:text-gray-400 text-xs sm:text-sm rounded-full pl-8 sm:pl-10 pr-10 sm:pr-11 py-2 sm:py-2.5 border border-gray-200/90 focus:bg-white focus:border-[#22A39E] focus:ring-3 focus:ring-[#22A39E]/15 transition-all outline-none shadow-2xs group-hover:border-gray-300"
            />
            <button
              id="search-submit-btn"
              type="submit"
              aria-label="بحث"
              className="absolute right-3 sm:right-3.5 text-gray-400 hover:text-[#22A39E] transition-colors cursor-pointer p-0.5"
            >
              <Search className="w-4 h-4 text-gray-400 group-focus-within:text-[#22A39E] transition-colors" />
            </button>
            {localSearch && (
              <button
                id="search-clear-btn"
                type="button"
                onClick={handleClear}
                aria-label="مسح البحث"
                className="absolute left-2.5 sm:left-3 text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-full hover:bg-gray-200/60"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>

        {/* Quick Customer Support Badge */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F7F7F7] border border-[#E5E5E5] text-xs font-medium text-black">
            <PhoneCall className="w-3.5 h-3.5 text-[#22A39E]" />
            <span>طلب فوري ومباشر</span>
          </div>
        </div>
      </div>
    </header>
  );
};
