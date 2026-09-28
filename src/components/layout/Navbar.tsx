import React from 'react';
import { RolemallCategory } from '../../types';
import { LayoutGrid, Sparkles } from 'lucide-react';
import { getCategoryIcon } from '../home/CategoryList';

interface NavbarProps {
  categories: RolemallCategory[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <nav id="categories-navbar" className="bg-white border-b border-gray-200/80 sticky top-[65px] z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-2.5 no-scrollbar">
          {/* All Products button */}
          <button
            id="nav-all-products-btn"
            onClick={() => onSelectCategory('')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
              selectedCategory === ''
                ? 'bg-[#22A39E] text-white border-[#22A39E] shadow-2xs'
                : 'bg-gray-50/80 text-gray-700 hover:bg-gray-100 border-gray-200/80'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>جميع المنتجات</span>
          </button>

          {/* Dynamic Categories from Rolemall with consistent icons */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === String(cat.id) || selectedCategory === cat.slug;
            const IconComponent = getCategoryIcon(cat.name);

            return (
              <button
                key={String(cat.id)}
                id={`nav-cat-${cat.id}`}
                onClick={() => onSelectCategory(String(cat.id))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                  isSelected
                    ? 'bg-[#22A39E] text-white font-bold border-[#22A39E] shadow-2xs'
                    : 'bg-gray-50/80 text-gray-700 hover:bg-gray-100 border-gray-200/80'
                }`}
              >
                <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-[#22A39E]'}`} />
                <span>{cat.name}</span>
                {cat.count && cat.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Special Deals badge */}
          <div className="mr-auto hidden md:flex items-center gap-1.5 text-xs text-[#22A39E] font-bold pr-2 shrink-0 bg-[#22A39E]/5 px-3 py-1 rounded-full border border-[#22A39E]/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>طلب فوري وشحن مجاني 100%</span>
          </div>
        </div>
      </div>
    </nav>
  );
};
