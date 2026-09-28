import React, { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';
import { HomeView } from './components/home/HomeView';
import { parseRoute } from './routing';
import { generateHeadTags } from './seo';
import { getCategories, getProducts, getProductDetails } from '../server/rolemall.server';
import { SSRData, SSRRoute, RolemallCategory, RolemallProduct } from './types';

export interface RenderResult {
  html: string;
  head: string;
  initialDataScript: string;
  status: number;
}

// Clean and minimal serialization helpers to eliminate duplicate and unused payload from SSR HTML
function cleanProductDetails(prod: RolemallProduct | null): RolemallProduct | null {
  if (!prod) return null;
  const clean: RolemallProduct = {
    id: prod.id,
    title: prod.title,
    price: prod.price,
    image: prod.image,
  };

  if (prod.old_price != null && prod.old_price > 0) clean.old_price = prod.old_price;
  if (prod.images && prod.images.length > 0) clean.images = prod.images;
  if (prod.category) clean.category = prod.category;
  if (prod.category_id) clean.category_id = prod.category_id;
  if (prod.description) clean.description = prod.description;
  if (prod.features && prod.features.length > 0) clean.features = prod.features;
  if (prod.available !== undefined) clean.available = prod.available;

  return clean;
}

function cleanProductCard(prod: RolemallProduct): RolemallProduct {
  const clean: RolemallProduct = {
    id: prod.id,
    title: prod.title,
    price: prod.price,
    image: prod.image,
  };

  if (prod.old_price != null && prod.old_price > 0) clean.old_price = prod.old_price;
  if (prod.category) clean.category = prod.category;

  return clean;
}

function cleanCategory(cat: RolemallCategory): RolemallCategory {
  const clean: RolemallCategory = {
    id: cat.id,
    name: cat.name,
  };
  if (cat.slug) clean.slug = cat.slug;
  if (cat.image) clean.image = cat.image;
  return clean;
}

export async function render(url: string, baseUrl?: string): Promise<RenderResult> {
  const [pathname, queryString] = url.split('?');
  const searchParams = new URLSearchParams(queryString || '');
  const parsed = parseRoute(pathname, searchParams);

  let status = 200;
  let categories: RolemallCategory[] = [];
  let products: RolemallProduct[] = [];
  let hasMore = false;
  let selectedProduct: RolemallProduct | null = null;
  let selectedCategoryObj: RolemallCategory | undefined = undefined;

  try {
    if (parsed.view === 'product' && parsed.productId) {
      // Fast single-resource fetch for Product Page (No blocking on categories or related products)
      const result = await getProductDetails(parsed.productId);
      if (result.status === 'found' && result.product) {
        selectedProduct = result.product;
      } else if (result.status === 'not_found') {
        status = 404;
        parsed.view = '404';
      } else {
        // temporarily_unavailable: do NOT claim the product doesn't exist
        status = 503;
        parsed.view = 'unavailable';
      }
    } else if (parsed.view === 'home') {
      const page = parsed.page || 1;
      const [catList, prodResult] = await Promise.all([
        getCategories(),
        getProducts({
          page,
          limit: 24,
          category: parsed.category,
          query: parsed.search,
        }),
      ]);

      categories = catList;
      products = prodResult.products || [];
      hasMore = Boolean(prodResult.hasMore);

      // Empty main listing = supplier problem, not a real empty store.
      // A non-200 status makes the SSR handler send no-store, so the CDN won't keep this empty page.
      if (products.length === 0 && !parsed.category && !parsed.search) {
        status = 503;
      }

      if (parsed.category) {
        selectedCategoryObj = categories.find(
          (c) => String(c.id) === parsed.category || c.slug === parsed.category
        );
      }
    } else {
      // 404
      status = 404;
      const [catList, prodResult] = await Promise.all([
        getCategories(),
        getProducts({ limit: 12 }),
      ]);
      categories = catList;
      products = prodResult.products || [];
    }
  } catch (err) {
    console.error('Error during SSR data retrieval:', err);
    // Graceful fallback to empty state
    status = 500;
  }

  const route: SSRRoute = {
    view: parsed.view,
    productId: parsed.productId,
    category: parsed.category,
    search: parsed.search,
    page: parsed.page || 1,
  };

  // Full SSR data used for initial server React render
  const ssrData: SSRData = {
    route,
    categories,
    products,
    hasMore,
    page: parsed.page || 1,
    selectedProduct,
    selectedCategory: parsed.category,
    searchQuery: parsed.search,
  };

  // Render React Tree to String
  const appHtml = renderToString(
    <StrictMode>
      <App ssrRoute={route} ssrData={ssrData} HomeViewSync={HomeView} />
    </StrictMode>
  );

  // Generate Head Tags (Title, Meta, OpenGraph, JSON-LD)
  const head = generateHeadTags({
    view: parsed.view,
    product: selectedProduct,
    category: selectedCategoryObj,
    categoryName: selectedCategoryObj?.name,
    search: parsed.search,
    baseUrl: baseUrl || process.env.APP_URL || 'https://tamam-iq.com',
    currentUrl: url,
  });

  // Minimal Client Hydration Payload - eliminates unused fields and duplicates
  let clientHydrationData: Partial<SSRData>;

  if (parsed.view === 'product' && selectedProduct) {
    clientHydrationData = {
      route: {
        view: 'product',
        productId: parsed.productId,
      },
      selectedProduct: cleanProductDetails(selectedProduct),
    };
  } else if (parsed.view === 'home') {
    clientHydrationData = {
      route: {
        view: 'home',
        category: parsed.category || undefined,
        search: parsed.search || undefined,
        page: parsed.page && parsed.page > 1 ? parsed.page : undefined,
      },
      categories: categories.map(cleanCategory),
      products: products.map(cleanProductCard),
      hasMore: hasMore || undefined,
      page: parsed.page && parsed.page > 1 ? parsed.page : undefined,
      selectedCategory: parsed.category || undefined,
      searchQuery: parsed.search || undefined,
    };
  } else {
    clientHydrationData = {
      route,
    };
  }

  // Serialize initial data safely (preventing XSS & ensuring no secrets)
  const safeDataJson = JSON.stringify(clientHydrationData).replace(/</g, '\\u003c');
  const initialDataScript = `<script id="__SSR_DATA__">window.__INITIAL_DATA__ = ${safeDataJson};</script>`;

  return {
    html: appHtml,
    head,
    initialDataScript,
    status,
  };
}
