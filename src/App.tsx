import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { RolemallProduct, RolemallCategory, PolicyType, OrderResult, SSRRoute, SSRData } from './types';
import { parseRoute } from './routing';
import { FunnelLandingPage } from './components/product/FunnelLandingPage';
import { TopLoadingBar } from './components/TopLoadingBar';
import { initMetaPixel, trackViewContent } from './lib/meta-pixel.client';
import { updatePageSEO, injectProductJsonLd } from './lib/seo';

// Code-split non-critical and deferred views to ensure minimum initial JS bundle for product page
const LazyHomeView = lazy(() =>
  import('./components/home/HomeView').then((m) => ({ default: m.HomeView }))
);
const LazySuccessView = lazy(() =>
  import('./components/order/SuccessView').then((m) => ({ default: m.SuccessView }))
);
const LazyNotFoundView = lazy(() =>
  import('./components/NotFoundView').then((m) => ({ default: m.NotFoundView }))
);
const LazyProductUnavailableView = lazy(() =>
  import('./components/ProductUnavailableView').then((m) => ({ default: m.ProductUnavailableView }))
);
const LazyPolicyModal = lazy(() =>
  import('./components/policy/PolicyModal').then((m) => ({ default: m.PolicyModal }))
);

interface AppProps {
  ssrRoute?: SSRRoute;
  ssrData?: SSRData;
  HomeViewSync?: React.ComponentType<any>;
}

export const App: React.FC<AppProps> = ({ ssrRoute, ssrData, HomeViewSync }) => {
  const [categories, setCategories] = useState<RolemallCategory[]>(() => ssrData?.categories || []);
  const [products, setProducts] = useState<RolemallProduct[]>(() => ssrData?.products || []);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(() => !ssrData?.products || ssrData.products.length === 0);
  const [page, setPage] = useState<number>(() => ssrData?.page || 1);
  const [hasMore, setHasMore] = useState<boolean>(() => Boolean(ssrData?.hasMore));
  const [selectedCategory, setSelectedCategory] = useState<string>(() => ssrData?.selectedCategory || '');
  const [searchQuery, setSearchQuery] = useState<string>(() => ssrData?.searchQuery || '');

  const [selectedProduct, setSelectedProduct] = useState<RolemallProduct | null>(() => ssrData?.selectedProduct || null);
  const [loadingProductDetails, setLoadingProductDetails] = useState<boolean>(false);
  const [isUnavailable, setIsUnavailable] = useState<boolean>(() => ssrRoute?.view === 'unavailable');
  const [notFoundState, setNotFoundState] = useState<{ active: boolean; type: 'product' | 'page' }>(() => {
    if (ssrRoute?.view === '404') {
      return { active: true, type: ssrRoute.productId ? 'product' : 'page' };
    }
    return { active: false, type: 'page' };
  });

  const [orderSuccess, setOrderSuccess] = useState<{
    orderId: string;
    orderDetails: {
      product: RolemallProduct;
      quantity: number;
      name: string;
      phone: string;
      governorate: string;
      address: string;
      totalPrice: number;
    };
  } | null>(null);

  const [activePolicy, setActivePolicy] = useState<PolicyType | null>(null);

  // Ref to skip duplicate initial client fetch if already supplied by SSR
  const isFirstMount = useRef(true);

  // Centralized instant scroll to top on any view, product, route, or filter navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [
    selectedProduct?.id,
    notFoundState.active,
    notFoundState.type,
    isUnavailable,
    orderSuccess?.orderId,
    selectedCategory,
    searchQuery,
    page,
  ]);

  // Initialize Meta Pixel on client load
  useEffect(() => {
    initMetaPixel();
  }, []);

  // Fetch Categories on client if not provided by SSR (and ONLY if not in a product view)
  useEffect(() => {
    // If in product view, skip loading categories to save network bandwidth
    if (selectedProduct) return;
    if (categories.length > 0) return;

    async function loadCategories() {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
    loadCategories();
  }, [categories.length, selectedProduct]);

  // Fetch Products on filter / pagination changes
  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '24');
      if (selectedCategory) params.set('category', selectedCategory);
      if (searchQuery) params.set('q', searchQuery);

      const res = await fetch(`/api/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, [page, selectedCategory, searchQuery]);

  // Only trigger loadProducts on client interactions (skipping initial mount if SSR supplied data or if in product view)
  useEffect(() => {
    // If in product view, skip loading general products catalog
    if (selectedProduct) {
      return;
    }
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (products.length > 0) {
        return;
      }
    }
    loadProducts();
  }, [loadProducts, selectedProduct, products.length]);

  // Handle client-side browser popstate & initial URL synchronization
  useEffect(() => {
    const handleUrlChange = async () => {
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      const parsed = parseRoute(currentPath, currentSearch);

      if (parsed.view === 'product' && parsed.productId) {
        if (!selectedProduct || String(selectedProduct.id) !== String(parsed.productId)) {
          fetchAndSetProduct(parsed.productId, false);
        }
      } else if (parsed.view === 'home') {
        setSelectedProduct(null);
        setNotFoundState({ active: false, type: 'page' });
        setIsUnavailable(false);
        setSelectedCategory(parsed.category || '');
        setSearchQuery(parsed.search || '');
        setPage(parsed.page || 1);
      } else if (parsed.view === '404') {
        setSelectedProduct(null);
        setIsUnavailable(false);
        setNotFoundState({ active: true, type: 'page' });
        updatePageSEO('الصفحة غير موجودة | تمام شوب');
      } else if (parsed.view === 'unavailable') {
        setSelectedProduct(null);
        setNotFoundState({ active: false, type: 'page' });
        setIsUnavailable(true);
        updatePageSEO('تعذّر تحميل المنتج مؤقتاً | تمام شوب');
      } else {
        setSelectedProduct(null);
        setNotFoundState({ active: false, type: 'page' });
        setIsUnavailable(false);
      }
    };

    window.addEventListener('popstate', handleUrlChange);

    // Also support legacy hash redirects (e.g. bookmarks with #product-123)
    if (window.location.hash.startsWith('#product-')) {
      const pId = window.location.hash.replace('#product-', '');
      if (pId) {
        window.history.replaceState(null, '', `/product/${pId}`);
        fetchAndSetProduct(pId, false);
      }
    }

    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [selectedProduct]);

  const fetchAndSetProduct = async (productId: string | number, pushHistory: boolean = true) => {
    setLoadingProductDetails(true);
    try {
      if (pushHistory && typeof window !== 'undefined') {
        window.history.pushState(null, '', `/product/${productId}`);
      }

      const res = await fetch(`/api/product-details?id=${encodeURIComponent(String(productId))}`);
      if (res.ok) {
        const prod = await res.json();
        if (prod && prod.id) {
          setSelectedProduct(prod);
          setNotFoundState({ active: false, type: 'product' });
          setIsUnavailable(false);
          setOrderSuccess(null);

          // Update Client SEO & JSON-LD
          updatePageSEO(prod.title, prod.description, prod.image);
          injectProductJsonLd(prod);

          // Track Meta ViewContent
          trackViewContent({
            id: prod.id,
            title: prod.title,
            price: prod.price,
          });
          return;
        }
      }

      // If explicitly 404 Not Found from supplier catalog
      if (res.status === 404) {
        setSelectedProduct(null);
        setIsUnavailable(false);
        setNotFoundState({ active: true, type: 'product' });
        updatePageSEO('المنتج غير موجود | تمام شوب');
        return;
      }

      // If temporary 503 / timeout / network failure
      setSelectedProduct(null);
      setNotFoundState({ active: false, type: 'product' });
      setIsUnavailable(true);
      updatePageSEO('تعذّر تحميل المنتج مؤقتاً | تمام شوب');
    } catch (err) {
      console.error('Failed to fetch product details:', err);
      setSelectedProduct(null);
      setNotFoundState({ active: false, type: 'product' });
      setIsUnavailable(true);
      updatePageSEO('تعذّر تحميل المنتج مؤقتاً | تمام شوب');
    } finally {
      setLoadingProductDetails(false);
    }
  };

  const handleSelectProduct = (product: RolemallProduct) => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/product/${product.id}`);
    }
    setSelectedProduct(product);
    setNotFoundState({ active: false, type: 'product' });
    setIsUnavailable(false);
    setOrderSuccess(null);

    // Client SEO & Pixel Tracking
    updatePageSEO(product.title, product.description, product.image);
    injectProductJsonLd(product);
    trackViewContent({
      id: product.id,
      title: product.title,
      price: product.price,
    });

    // If card payload was compact (no full gallery/description), seamlessly enrich in background
    if (!product.images || product.images.length === 0 || !product.description) {
      fetch(`/api/product-details?id=${encodeURIComponent(String(product.id))}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((fullProd) => {
          if (fullProd && fullProd.id) {
            setSelectedProduct((current) =>
              current && String(current.id) === String(fullProd.id)
                ? { ...current, ...fullProd }
                : current
            );
          }
        })
        .catch(() => {});
    }
  };

  const handleBackToHome = () => {
    setSelectedProduct(null);
    setNotFoundState({ active: false, type: 'page' });
    setIsUnavailable(false);
    setOrderSuccess(null);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/');
    }
    updatePageSEO('تمام شوب | TAMAM SHOP - متجر إلكتروني للأجهزة والمنتجات الحديثة');
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setPage(1);
    setSelectedProduct(null);
    setNotFoundState({ active: false, type: 'page' });
    setIsUnavailable(false);
    setOrderSuccess(null);
    if (typeof window !== 'undefined') {
      const newUrl = q ? `/?q=${encodeURIComponent(q)}` : '/';
      window.history.pushState(null, '', newUrl);
    }
  };

  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    setSearchQuery('');
    setPage(1);
    setSelectedProduct(null);
    setNotFoundState({ active: false, type: 'page' });
    setIsUnavailable(false);
    setOrderSuccess(null);
    if (typeof window !== 'undefined') {
      const newUrl = catId ? `/?category=${encodeURIComponent(catId)}` : '/';
      window.history.pushState(null, '', newUrl);
    }
  };

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSearchQuery('');
    setPage(1);
    setNotFoundState({ active: false, type: 'page' });
    setIsUnavailable(false);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/');
    }
  };

  const handleOrderSuccess = (
    result: OrderResult,
    orderDetails: {
      product: RolemallProduct;
      quantity: number;
      name: string;
      phone: string;
      governorate: string;
      address: string;
      totalPrice: number;
    }
  ) => {
    if (result.orderId) {
      setOrderSuccess({
        orderId: result.orderId,
        orderDetails,
      });
    }
  };

  const selectedCategoryObj = categories.find(
    (c) => String(c.id) === selectedCategory || c.slug === selectedCategory
  );

  const ActiveHomeView = HomeViewSync || LazyHomeView;

  // Single composite trigger matching the exact dependencies of the scroll-to-top navigation useEffect
  const navTrigger = JSON.stringify([
    selectedProduct?.id,
    notFoundState.active,
    notFoundState.type,
    isUnavailable,
    orderSuccess?.orderId,
    selectedCategory,
    searchQuery,
    page,
  ]);

  // VIEW 1: Success Screen after order completion
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-white text-black font-['Cairo',sans-serif]">
        <TopLoadingBar trigger={navTrigger} />
        <Suspense fallback={null}>
          <LazySuccessView
            orderId={orderSuccess.orderId}
            orderDetails={orderSuccess.orderDetails}
            onContinueShopping={handleBackToHome}
          />
          {activePolicy && (
            <LazyPolicyModal
              type={activePolicy}
              onClose={() => setActivePolicy(null)}
            />
          )}
        </Suspense>
      </div>
    );
  }

  // VIEW 2.1: Temporarily Unavailable Screen
  if (isUnavailable) {
    return (
      <div className="min-h-screen bg-white text-black font-['Cairo',sans-serif]">
        <TopLoadingBar trigger={navTrigger} />
        <Suspense fallback={null}>
          <LazyProductUnavailableView
            onBackToHome={handleBackToHome}
            onOpenPolicy={(type) => setActivePolicy(type)}
          />
          {activePolicy && (
            <LazyPolicyModal
              type={activePolicy}
              onClose={() => setActivePolicy(null)}
            />
          )}
        </Suspense>
      </div>
    );
  }

  // VIEW 2.2: 404 Not Found Screen (for products or pages)
  if (notFoundState.active) {
    return (
      <div className="min-h-screen bg-white text-black font-['Cairo',sans-serif]">
        <TopLoadingBar trigger={navTrigger} />
        <Suspense fallback={null}>
          <LazyNotFoundView
            type={notFoundState.type}
            onBackToHome={handleBackToHome}
            onOpenPolicy={(type) => setActivePolicy(type)}
          />
          {activePolicy && (
            <LazyPolicyModal
              type={activePolicy}
              onClose={() => setActivePolicy(null)}
            />
          )}
        </Suspense>
      </div>
    );
  }

  // VIEW 3: High-Converting Funnel Landing Page (NO general store header or categories navbar)
  if (selectedProduct) {
    return (
      <div className="min-h-screen bg-white text-black font-['Cairo',sans-serif]">
        <TopLoadingBar trigger={navTrigger} />
        <FunnelLandingPage
          product={selectedProduct}
          allProducts={products}
          onBackToHome={handleBackToHome}
          onSelectProduct={handleSelectProduct}
          onOrderSuccess={handleOrderSuccess}
          onOpenPolicy={(type) => setActivePolicy(type)}
        />
        <Suspense fallback={null}>
          {activePolicy && (
            <LazyPolicyModal
              type={activePolicy}
              onClose={() => setActivePolicy(null)}
            />
          )}
        </Suspense>
      </div>
    );
  }

  // VIEW 4: Main Store Home (Header, Categories, Products, Trust, Footer)
  return (
    <>
      <TopLoadingBar trigger={navTrigger} />
      <Suspense fallback={null}>
        <ActiveHomeView
          categories={categories}
          products={products}
          loadingProducts={loadingProducts}
          page={page}
          hasMore={hasMore}
          selectedCategory={selectedCategory}
          selectedCategoryObj={selectedCategoryObj}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSelectCategory={handleSelectCategory}
          onPageChange={(newPage: number) => setPage(newPage)}
          onSelectProduct={handleSelectProduct}
          onResetFilters={handleResetFilters}
          onResetToHome={handleBackToHome}
          onOpenPolicy={(type: PolicyType) => setActivePolicy(type)}
        />
        {activePolicy && (
          <LazyPolicyModal
            type={activePolicy}
            onClose={() => setActivePolicy(null)}
          />
        )}
      </Suspense>
    </>
  );
};

export default App;

