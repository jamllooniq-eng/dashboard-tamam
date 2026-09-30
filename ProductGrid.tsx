import React from 'react';
import { RolemallProduct } from '../../types';
import { ProductCard } from './ProductCard';
import { ChevronRight, ChevronLeft, Search, FilterX } from 'lucide-react';

interface ProductGridProps {
  products: RolemallProduct[];
  loading: boolean;
  total?: number;
  page: number;
  hasMore?: boolean;
  selectedCategoryName?: string;
  searchQuery?: string;
  onPageChange: (newPage: number) => void;
  onSelectProduct: (product: RolemallProduct) => void;
  onResetFilters: () => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  loading,
  page,
  hasMore,
  selectedCategoryName,
  searchQuery,
  onPageChange,
  onSelectProduct,
  onResetFilters,
}) => {
  return (
    <section id="products" className="py-6 sm:py-8 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Title and Filter Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3.5 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-5 bg-[#22A39E] rounded-xs"></div>
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900">
                {searchQuery
                  ? `نتائج البحث عن: "${searchQuery}"`
                  : selectedCategoryName
                  ? `قسم: ${selectedCategoryName}`
                  : 'أحدث المنتجات والعروض'}
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              جميع الأسعار بالدينار العراقي وتشمل التوصيل المجاني لكافة المحافظات
            </p>
          </div>

          {(searchQuery || selectedCategoryName) && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F7F7F7] border border-[#E5E5E5] text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>إلغاء الفلاتر والبحث</span>
            </button>
          )}
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden animate-pulse flex flex-col justify-between"
              >
                <div className="aspect-square bg-[#F7F7F7]"></div>
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-gray-200 rounded-sm w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded-sm w-full"></div>
                  <div className="h-4 bg-gray-200 rounded-sm w-2/3"></div>
                  <div className="pt-2 flex justify-between items-center">
                    <div className="h-5 bg-gray-200 rounded-sm w-1/2"></div>
                  </div>
                  <div className="h-9 bg-gray-200 rounded-lg w-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {products.map((product, index) => (
                <ProductCard
                  key={String(product.id)}
                  product={product}
                  onSelect={onSelectProduct}
                  priority={index < 4}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="mt-12 flex items-center justify-center gap-3 pt-6 border-t border-[#E5E5E5]">
              <button
                id="pagination-prev-btn"
                disabled={page <= 1}
                onClick={() => {
                  onPageChange(page - 1);
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2 rounded-lg border border-[#E5E5E5] text-xs font-bold text-gray-700 bg-white hover:bg-[#F7F7F7] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              <div className="px-4 py-2 rounded-lg bg-[#F7F7F7] text-xs font-bold text-black border border-[#E5E5E5]">
                الصفحة {page}
              </div>

              <button
                id="pagination-next-btn"
                disabled={!hasMore && products.length < 24}
                onClick={() => {
                  onPageChange(page + 1);
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2 rounded-lg border border-[#E5E5E5] text-xs font-bold text-gray-700 bg-white hover:bg-[#F7F7F7] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          /* Empty Search / Filter State */
          <div className="py-16 text-center bg-[#F7F7F7] rounded-2xl border border-[#E5E5E5] p-8">
            <div className="w-14 h-14 rounded-full bg-white border border-[#E5E5E5] flex items-center justify-center text-gray-400 mx-auto mb-4">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-black mb-2">
              لم نتمكن من العثور على أي منتجات
            </h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mb-6">
              جرّب استخدام كلمات بحث مختلفة أو تصفح جميع الأقسام والمنتجات المتوفرة.
            </p>
            <button
              onClick={onResetFilters}
              className="px-6 py-2.5 rounded-full bg-[#22A39E] text-white text-xs font-bold hover:bg-[#1b8581] transition-colors cursor-pointer"
            >
              عرض جميع المنتجات
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
