import React from 'react';
import {
  Layers,
  LayoutGrid,
  Smartphone,
  Tv,
  Home as HomeIcon,
  Sparkles,
  Watch,
  Car,
  Shirt,
  Baby,
  Wrench,
  Dumbbell,
  ShoppingBag,
  Zap,
  Tag,
  Headphones,
  Laptop,
  Camera,
  UtensilsCrossed,
  Flame,
} from 'lucide-react';
import { RolemallCategory } from '../../types';

interface CategoryListProps {
  categories: RolemallCategory[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

// Smart Icon Resolver based on Arabic Category Names
export function getCategoryIcon(name: string = ''): React.ElementType {
  const lower = name.toLowerCase();

  if (lower.includes('هاتف') || lower.includes('موبايل') || lower.includes('جوال') || lower.includes('phone')) {
    return Smartphone;
  }
  if (lower.includes('الكترون') || lower.includes('إلكترون') || lower.includes('تلفزيون') || lower.includes('شاش') || lower.includes('tv') || lower.includes('tech')) {
    return Tv;
  }
  if (lower.includes('سماع') || lower.includes('صوت') || lower.includes('audio') || lower.includes('headphone')) {
    return Headphones;
  }
  if (lower.includes('كمبيوتر') || lower.includes('لابتوب') || lower.includes('حاسوب') || lower.includes('laptop')) {
    return Laptop;
  }
  if (lower.includes('كامير') || lower.includes('تصوير') || lower.includes('camera')) {
    return Camera;
  }
  if (lower.includes('ساع') || lower.includes('اكسسوار') || lower.includes('إكسسوار') || lower.includes('watch')) {
    return Watch;
  }
  if (lower.includes('منزل') || lower.includes('بيت') || lower.includes('ديكور') || lower.includes('home')) {
    return HomeIcon;
  }
  if (lower.includes('مطبخ') || lower.includes('طعام') || lower.includes('طهي') || lower.includes('kitchen')) {
    return UtensilsCrossed;
  }
  if (lower.includes('جمال') || lower.includes('عناي') || lower.includes('مكياج') || lower.includes('عطر') || lower.includes('beauty')) {
    return Sparkles;
  }
  if (lower.includes('سيار') || lower.includes('مركب') || lower.includes('car') || lower.includes('auto')) {
    return Car;
  }
  if (lower.includes('ملابس') || lower.includes('ازياء') || lower.includes('أزياء') || lower.includes('fashion') || lower.includes('cloth')) {
    return Shirt;
  }
  if (lower.includes('طفل') || lower.includes('اطفال') || lower.includes('أطفال') || lower.includes('العاب') || lower.includes('ألعاب') || lower.includes('baby') || lower.includes('kids')) {
    return Baby;
  }
  if (lower.includes('رياض') || lower.includes('لياق') || lower.includes('gym') || lower.includes('sport')) {
    return Dumbbell;
  }
  if (lower.includes('عدد') || lower.includes('ادوات') || lower.includes('أدوات') || lower.includes('صيان') || lower.includes('tool')) {
    return Wrench;
  }
  if (lower.includes('عرض') || lower.includes('تخفيض') || lower.includes('خصم') || lower.includes('offer')) {
    return Flame;
  }

  return Tag;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <section id="categories-section" className="relative w-full bg-white border-b border-gray-100 py-3 sm:py-3.5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth">
          {/* All Categories Box */}
          <button
            id="cat-card-all"
            onClick={() => onSelectCategory('')}
            className={`group inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer border ${
              selectedCategory === ''
                ? 'bg-[#22A39E] text-white border-[#22A39E] shadow-sm'
                : 'bg-white hover:bg-gray-50 text-gray-800 border-gray-200/90 hover:border-[#22A39E]/40 shadow-2xs'
            }`}
          >
            <div
              className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                selectedCategory === ''
                  ? 'bg-white/20 text-white'
                  : 'bg-[#F4F6F8] text-[#22A39E] group-hover:bg-[#22A39E] group-hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
            </div>
            <span>كل المنتجات</span>
          </button>

          {/* Dynamic Categories with Uniform Icon Proportions */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === String(cat.id) || selectedCategory === cat.slug;
            const IconComponent = getCategoryIcon(cat.name);

            return (
              <button
                key={String(cat.id)}
                id={`cat-card-${cat.id}`}
                onClick={() => {
                  onSelectCategory(String(cat.id));
                }}
                className={`group inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'bg-[#22A39E] text-white border-[#22A39E] shadow-sm'
                    : 'bg-white hover:bg-gray-50 text-gray-800 border-gray-200/90 hover:border-[#22A39E]/40 shadow-2xs'
                }`}
              >
                <div
                  className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-[#F4F6F8] text-[#22A39E] group-hover:bg-[#22A39E] group-hover:text-white'
                  }`}
                >
                  <IconComponent className="w-4 h-4 shrink-0" />
                </div>
                <span>{cat.name}</span>
                {typeof cat.count === 'number' && cat.count > 0 && (
                  <span
                    className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
