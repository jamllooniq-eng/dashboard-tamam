import React from 'react';
import { RolemallCategory, RolemallProduct, PolicyType } from '../../types';
import { Header } from '../layout/Header';
import { Footer } from '../layout/Footer';
import { CategoryList } from './CategoryList';
import { ProductGrid } from './ProductGrid';
import { TrustSection } from './TrustSection';

interface HomeViewProps {
  categories: RolemallCategory[];
  products: RolemallProduct[];
  loadingProducts: boolean;
  page: number;
  hasMore: boolean;
  selectedCategory: string;
  selectedCategoryObj?: RolemallCategory;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectCategory: (catId: string) => void;
  onPageChange: (newPage: number) => void;
  onSelectProduct: (product: RolemallProduct) => void;
  onResetFilters: () => void;
  onResetToHome: () => void;
  onOpenPolicy: (type: PolicyType) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  categories,
  products,
  loadingProducts,
  page,
  hasMore,
  selectedCategory,
  selectedCategoryObj,
  searchQuery,
  onSearchChange,
  onSelectCategory,
  onPageChange,
  onSelectProduct,
  onResetFilters,
  onResetToHome,
  onOpenPolicy,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-white text-black font-['Cairo',sans-serif]">
      {/* 1. Header with Search & Branding */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onResetToHome={onResetToHome}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Single Unified Categories Bar with Icons */}
        {!searchQuery && (
          <CategoryList
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
          />
        )}

        {/* Products Grid */}
        <ProductGrid
          products={products}
          loading={loadingProducts}
          page={page}
          hasMore={hasMore}
          selectedCategoryName={selectedCategoryObj?.name}
          searchQuery={searchQuery}
          onPageChange={onPageChange}
          onSelectProduct={onSelectProduct}
          onResetFilters={onResetFilters}
        />

        {/* Trust Pillars */}
        <TrustSection />
      </main>

      {/* Footer */}
      <Footer
        onOpenPolicy={onOpenPolicy}
        onSelectCategory={onSelectCategory}
        onResetToHome={onResetToHome}
      />
    </div>
  );
};
