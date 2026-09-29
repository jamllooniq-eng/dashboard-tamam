/**
 * Rolemall API Server-Side Adapter
 * Strictly server-side: Token is NEVER exposed to the browser.
 * Includes In-Flight Request Coalescing, Stale-While-Revalidate,
 * Exponential Backoff with Jitter for 429 Rate Limiting, and Robust Fallbacks.
 */

import { RolemallProduct, RolemallCategory, ProductsResponse } from '../src/types';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  kvGet,
  kvSet,
  kvSetMany,
  kvDeleteMany,
  listActiveManualProducts,
  getManualProduct,
  manualRowToProduct,
  parseManualId,
} from './supabase.server';

// Supplier token is read from Netlify environment variables (never hardcode it in the repo).
const SUPPLIER_API_TOKEN = (process.env.ROLEMALL_API_TOKEN || '').trim();
if (!SUPPLIER_API_TOKEN) {
  console.error('[Rolemall] ROLEMALL_API_TOKEN is not set. Add it in Netlify > Site configuration > Environment variables.');
}
const BASE_URL = 'https://rolemall.com/api';

// Cache TTL configuration
const FRESH_TTL_MS = 15 * 60 * 1000; // 15 minutes (Fresh: instant hit without revalidation)
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (Stale: instant response + background refresh)

// Persistent Disk Cache Store Directory (survives process restarts and cold starts)
const CACHE_DIR = path.join(os.tmpdir(), 'rolemall_cache_store');
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (e) {
  // Silent fallback if tmpdir has restricted permissions
}

function getDiskCache<T>(key: string): CacheEntry<T> | null {
  try {
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(CACHE_DIR, `${sanitizedKey}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as CacheEntry<T>;
    }
  } catch (e) {
    // Disk read fallback
  }
  return null;
}

function setDiskCache<T>(key: string, entry: CacheEntry<T>): void {
  try {
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(CACHE_DIR, `${sanitizedKey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
  } catch (e) {
    // Disk write fallback
  }
}

/**
 * Persistent cache = local /tmp disk (fast, per instance) + Supabase (shared, survives cold starts).
 * Supabase is what keeps the catalog visible when Rolemall is down and the function instance is new.
 */
async function getPersistedCache<T>(key: string): Promise<CacheEntry<T> | null> {
  const disk = getDiskCache<T>(key);
  if (disk) return disk;
  const remote = await kvGet<T>(key);
  if (remote) {
    setDiskCache(key, remote);
    return remote;
  }
  return null;
}

/** Forget a product everywhere (memory, disk, Supabase) once the supplier confirms it's gone. */
async function purgeProduct(pId: string): Promise<void> {
  memoryCache.productDetails.delete(pId);
  try {
    const filePath = path.join(CACHE_DIR, `${`product_${pId}`.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
  if (catalogSnapshot) {
    catalogSnapshot.products = catalogSnapshot.products.filter((p) => String(p.id) !== pId);
  }
  await kvDeleteMany([`product_${pId}`]);
}

async function setPersistedCache<T>(key: string, entry: CacheEntry<T>): Promise<void> {
  setDiskCache(key, entry);
  await kvSet(key, entry.data, entry.timestamp);
}

// In-memory Cache Store
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// ⚠️ ملاحظة معمارية هامة بخصوص التخزين المؤقت بالذاكرة (In-Memory Cache)
// - هذا الكاش محلي بالكامل ومخزّن داخل ذاكرة الرام (In-Memory) الخاصة بعملية Node.js الحالية فقط.
// - يُصفَّر بالكامل عند أي إعادة تشغيل للسيرفر (Redeploy، Crash، أو Server Restart).
// - في حال التوسع الأفقي وتشغيل أكثر من نسخة سيرفر خلف Load Balancer (Horizontal Scaling)،
//   تمتلك كل نسخة سيرفر كاش مستقل خاص بها، ولا تتشارك البيانات تلقائياً.
// - للتوسع المستقبلي في الإنتاج عالي الكثافة، يُنصح باستبداله بتخزين مركزي مشترك مثل Redis.
// ---------------------------------------------------------------------------
const memoryCache = {
  products: new Map<string, CacheEntry<ProductsResponse>>(),
  categories: null as CacheEntry<RolemallCategory[]> | null,
  categoryMap: new Map<string, string>(),
  productDetails: new Map<string, CacheEntry<RolemallProduct>>(),
};

// In-flight Promise Coalescing (Singleflight)
const inFlightRequests = new Map<string, Promise<any>>();

// Negative cache: remember product IDs confirmed missing, so bad/fake links
// can't hammer the Rolemall API with repeated full-catalog rescue scans.
const notFoundCache = new Map<string, number>();
const NOT_FOUND_TTL_MS = 10 * 60 * 1000; // 10 minutes
const VALID_PRODUCT_ID = /^[A-Za-z0-9_-]{1,64}$/;

// Full-catalog snapshot written by the hourly sync (netlify/functions/sync-catalog.ts).
// Used as the last line of defence when Rolemall is down: every product that existed
// at the last successful sync stays visible with its last known price.
const CATALOG_KEY = 'catalog_all';
let catalogSnapshot: { products: RolemallProduct[]; loadedAt: number } | null = null;
const CATALOG_MEMORY_TTL_MS = 10 * 60 * 1000;

async function loadCatalogSnapshot(): Promise<RolemallProduct[]> {
  const now = Date.now();
  if (catalogSnapshot && now - catalogSnapshot.loadedAt < CATALOG_MEMORY_TTL_MS) {
    return catalogSnapshot.products;
  }
  const remote = await kvGet<RolemallProduct[]>(CATALOG_KEY);
  if (remote && Array.isArray(remote.data)) {
    catalogSnapshot = { products: remote.data, loadedAt: now };
    return remote.data;
  }
  return catalogSnapshot?.products || [];
}

// Rate-limiting tracking & cooldown
let rateLimitedUntil = 0;

/**
 * Utility delay with jitter
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to normalize any item from Rolemall to standard RolemallProduct
 */
function normalizeProduct(raw: any, categoryNameMap?: Map<string, string>): RolemallProduct | null {
  if (!raw) return null;

  // 1. Extract ID
  const rawId = raw._id !== undefined ? raw._id : (raw.id !== undefined ? raw.id : (raw.product_id || raw.item_id));
  if (rawId === undefined || rawId === null || rawId === '') return null;
  const id = rawId;

  // 2. Extract Price (price, unit_price, sale_price) - Strictly require a valid positive price
  let rawPrice = NaN;
  if (raw.price !== undefined && raw.price !== null && raw.price !== '') {
    rawPrice = Number(raw.price);
  } else if (raw.unit_price !== undefined && raw.unit_price !== null && raw.unit_price !== '') {
    rawPrice = Number(raw.unit_price);
  } else if (raw.sale_price !== undefined && raw.sale_price !== null && raw.sale_price !== '') {
    rawPrice = Number(raw.sale_price);
  }

  // Reject the product entirely if no valid positive price is present (never invent a price)
  if (isNaN(rawPrice) || rawPrice <= 0) {
    return null;
  }
  const price = rawPrice;

  // 3. Extract Title / Name
  const title = String(raw.name || raw.title || raw.product_name || '').trim();
  if (!title) return null;

  // 4. Extract Old Price (old_price, original_price, regular_price) - Only if strictly present and greater than price
  let old_price: number | null = null;
  let rawOldPrice = NaN;
  if (raw.old_price !== undefined && raw.old_price !== null && raw.old_price !== '') {
    rawOldPrice = Number(raw.old_price);
  } else if (raw.original_price !== undefined && raw.original_price !== null && raw.original_price !== '') {
    rawOldPrice = Number(raw.original_price);
  } else if (raw.regular_price !== undefined && raw.regular_price !== null && raw.regular_price !== '') {
    rawOldPrice = Number(raw.regular_price);
  }

  if (!isNaN(rawOldPrice) && rawOldPrice > price) {
    old_price = rawOldPrice;
  }

  // 5. Extract Images
  let image = '';
  const images: string[] = [];

  if (Array.isArray(raw.img)) {
    raw.img.forEach((item: any) => {
      const src = typeof item === 'string' ? item.trim() : (item?.url || item?.src || '');
      if (src && !images.includes(src)) {
        images.push(src);
      }
    });
  } else if (typeof raw.img === 'string' && raw.img.trim()) {
    const src = raw.img.trim();
    images.push(src);
  }

  if (Array.isArray(raw.images)) {
    raw.images.forEach((item: any) => {
      const src = typeof item === 'string' ? item.trim() : (item?.url || item?.src || item?.image || '');
      if (src && !images.includes(src)) {
        images.push(src);
      }
    });
  }

  if (typeof raw.image === 'string' && raw.image.trim()) {
    const src = raw.image.trim();
    if (!images.includes(src)) images.unshift(src);
  }

  if (images.length > 0) {
    image = images[0];
  }

  // Descriptions: body & post_body
  const fullBody = String(raw.body || raw.description || raw.desc || raw.details || '').trim();
  const postBody = String(raw.post_body || raw.short_description || '').trim();
  const description = fullBody || postBody || undefined;

  // Features from API only (do not duplicate description text)
  let features: string[] = [];
  if (Array.isArray(raw.features) && raw.features.length > 0) {
    features = raw.features.map((f: any) => String(f).trim()).filter(Boolean);
  }

  // Category
  const catRaw = raw.category !== undefined ? raw.category : (raw.category_id || raw.cat_id);
  const category_id = catRaw !== undefined && catRaw !== null ? String(catRaw) : undefined;
  
  let category: string | undefined = undefined;
  if (categoryNameMap && category_id && categoryNameMap.has(category_id)) {
    category = categoryNameMap.get(category_id);
  } else if (typeof raw.category === 'string' && isNaN(Number(raw.category)) && raw.category.trim()) {
    category = raw.category.trim();
  } else if (raw.category_name && String(raw.category_name).trim()) {
    category = String(raw.category_name).trim();
  }

  // 6. Vendor: Only use actual vendor/seller/brand if present; otherwise leave undefined
  let vendor: string | undefined = undefined;
  const rawVendor = raw.vendor || raw.seller || raw.brand;
  if (typeof rawVendor === 'string' && rawVendor.trim()) {
    vendor = rawVendor.trim();
  }

  // 7. Stock: Only use if raw.stock is defined and valid number; otherwise undefined
  let stock: number | undefined = undefined;
  if (raw.stock !== undefined && raw.stock !== null && raw.stock !== '') {
    const parsedStock = Number(raw.stock);
    if (!isNaN(parsedStock)) {
      stock = parsedStock;
    }
  }

  // 8. Availability: Reflect raw.available or stock > 0, default to true if unknown without faking stock
  let available = true;
  if (raw.available !== undefined && raw.available !== null) {
    available = Boolean(raw.available);
  } else if (stock !== undefined) {
    available = stock > 0;
  }

  const sku = raw.sku || raw.code ? String(raw.sku || raw.code).trim() : undefined;

  return {
    id,
    title,
    price,
    old_price,
    image,
    images: images.length > 0 ? images : (image ? [image] : []),
    category,
    category_id,
    description,
    vendor,
    sku,
    available,
    stock,
    features: features.length > 0 ? features : undefined,
  };
}

/**
 * Resilient Fetcher with retry on 429 and network errors
 */
async function resilientFetch(url: string, maxRetries = 2): Promise<Response> {
  // Test switch: set SIMULATE_ROLEMALL_DOWN=true in Netlify to see how the site behaves
  // when the supplier is unreachable. Never leave it on in production.
  if (String(process.env.SIMULATE_ROLEMALL_DOWN || '').toLowerCase() === 'true') {
    throw new Error('Simulated Rolemall outage (SIMULATE_ROLEMALL_DOWN=true)');
  }

  // Without the token Rolemall answers with demo products instead of an error.
  // Treat it as an outage so the saved copy is shown and never overwritten with demo data.
  if (!SUPPLIER_API_TOKEN && !url.includes('/categories')) {
    throw new Error('ROLEMALL_API_TOKEN missing: serving saved products');
  }

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // If currently rate limited, delay before attempting
    const now = Date.now();
    if (rateLimitedUntil > now) {
      const waitMs = Math.min(rateLimitedUntil - now, 3000) + Math.random() * 200;
      await sleep(waitMs);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TamamShop/1.0',
        },
      });
      clearTimeout(timeout);

      if (res.status === 429) {
        // Mark cooldown period for 4 seconds
        rateLimitedUntil = Date.now() + 4000;
        if (attempt < maxRetries) {
          const backoff = (attempt + 1) * 800 + Math.random() * 400;
          await sleep(backoff);
          continue;
        }
      }

      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const backoff = (attempt + 1) * 500 + Math.random() * 300;
        await sleep(backoff);
      }
    }
  }

  throw lastError || new Error(`Failed to fetch from ${url}`);
}

/**
 * Fetch Categories from Rolemall API
 */
export async function getCategories(): Promise<RolemallCategory[]> {
  const now = Date.now();

  // Tier 1: Memory
  if (memoryCache.categories && (now - memoryCache.categories.timestamp < FRESH_TTL_MS)) {
    return memoryCache.categories.data;
  }

  // Tier 2: Disk Cache
  if (!memoryCache.categories) {
    const diskEntry = await getPersistedCache<RolemallCategory[]>('categories_all');
    if (diskEntry) {
      memoryCache.categories = diskEntry;
      for (const item of diskEntry.data) {
        memoryCache.categoryMap.set(String(item.id), item.name);
      }
      if (now - diskEntry.timestamp < FRESH_TTL_MS) {
        return diskEntry.data;
      }
      // If stale on disk, trigger background revalidation
      if (now - diskEntry.timestamp < STALE_TTL_MS) {
        triggerCategoriesBackgroundRefresh();
        return diskEntry.data;
      }
    }
  }

  // If memory has stale data, return immediately and refresh in background
  if (memoryCache.categories && (now - memoryCache.categories.timestamp < STALE_TTL_MS)) {
    triggerCategoriesBackgroundRefresh();
    return memoryCache.categories.data;
  }

  return fetchCategoriesDirect();
}

function triggerCategoriesBackgroundRefresh(): void {
  const key = 'categories_all';
  if (!inFlightRequests.has(key)) {
    fetchCategoriesDirect().catch(() => {});
  }
}

async function fetchCategoriesDirect(): Promise<RolemallCategory[]> {
  const now = Date.now();
  const key = 'categories_all';
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const fetchPromise = (async () => {
    try {
      // NOTE: NO trailing slash to avoid 307 redirect
      const res = await resilientFetch(`${BASE_URL}/categories`, 2);

      if (!res.ok) {
        console.warn(`Categories API returned status ${res.status}`);
        if (memoryCache.categories?.data) {
          return memoryCache.categories.data;
        }
        return [];
      }

      const json = await res.json();
      let rawList: any[] = [];

      if (json.data && Array.isArray(json.data.categories)) {
        rawList = json.data.categories;
      } else if (json.data && Array.isArray(json.data)) {
        rawList = json.data;
      } else if (Array.isArray(json.categories)) {
        rawList = json.categories;
      } else if (Array.isArray(json)) {
        rawList = json;
      }

      const categories: RolemallCategory[] = [];
      for (const item of rawList) {
        const rawId = item._id !== undefined ? item._id : (item.id !== undefined ? item.id : item.category_id);
        const name = String(item.name || item.title || item.category_name || item.ar_name || '').trim();
        
        if (rawId !== undefined && name) {
          const id = rawId;
          const idStr = String(id);
          memoryCache.categoryMap.set(idStr, name);

          categories.push({
            id,
            name,
            slug: item.slug || idStr,
            image: item.img || item.image || item.icon || '',
            count: item.count || item.products_count || item.total || undefined,
          });
        }
      }

      if (categories.length > 0) {
        const entry = {
          data: categories,
          timestamp: Date.now(),
        };
        memoryCache.categories = entry;
        await setPersistedCache('categories_all', entry);
        return categories;
      }
    } catch (err) {
      console.warn('Notice: Using cached categories fallback due to fetch error:', (err as any)?.message || err);
    }

    // Supplier failed: serve the last known good categories, however old
    return memoryCache.categories?.data || [];
  })();

  inFlightRequests.set(key, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightRequests.delete(key);
  }
}

/**
 * Fetch Products List from Rolemall API
 */
async function getRolemallProducts(options: {
  page?: number;
  limit?: number;
  category?: string;
  query?: string;
} = {}): Promise<ProductsResponse> {
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.max(1, Math.min(100, Number(options.limit || 24)));
  const category = (options.category || '').trim();
  const query = (options.query || '').trim();

  const cacheKey = `p_${page}_l_${limit}_c_${category}_q_${query}`;
  const now = Date.now();

  let cached = memoryCache.products.get(cacheKey);
  if (!cached) {
    const diskEntry = query
      ? getDiskCache<ProductsResponse>(`products_${cacheKey}`)
      : await getPersistedCache<ProductsResponse>(`products_${cacheKey}`);
    if (diskEntry) {
      cached = diskEntry;
      memoryCache.products.set(cacheKey, diskEntry);
      // Index products into individual memory cache as well
      for (const p of diskEntry.data.products) {
        if (!memoryCache.productDetails.has(String(p.id))) {
          memoryCache.productDetails.set(String(p.id), {
            data: p,
            timestamp: diskEntry.timestamp,
          });
        }
      }
    }
  }

  // 1. Fresh Cache Hit
  if (cached && (now - cached.timestamp < FRESH_TTL_MS)) {
    return cached.data;
  }

  // 2. Stale Cache Hit with Background Refresh
  if (cached && (now - cached.timestamp < STALE_TTL_MS)) {
    if (!inFlightRequests.has(cacheKey)) {
      fetchProductsDirect(cacheKey, page, limit, category, query).catch(() => {});
    }
    return cached.data;
  }

  return fetchProductsDirect(cacheKey, page, limit, category, query);
}

async function fetchProductsDirect(
  cacheKey: string,
  page: number,
  limit: number,
  category: string,
  query: string
): Promise<ProductsResponse> {
  const now = Date.now();
  const cached = memoryCache.products.get(cacheKey);

  // Request Coalescing
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    // Ensure category mapping is loaded (non-blocking if already cached)
    if (memoryCache.categoryMap.size === 0) {
      await getCategories().catch(() => []);
    }

    try {
      const params = new URLSearchParams();
      params.set('token', SUPPLIER_API_TOKEN);
      params.set('limit', String(limit));
      params.set('page', String(page));

      if (category) {
        params.set('category', category);
      }
      if (query) {
        params.set('search', query);
      }

      // NOTE: NO trailing slash to avoid 307 redirect
      const url = `${BASE_URL}/products?${params.toString()}`;
      const res = await resilientFetch(url, 2);

      if (!res.ok) {
        console.warn(`Rolemall products API returned ${res.status}`);
        if (cached) {
          return cached.data;
        }
        throw new Error(`Products API returned status ${res.status}`);
      }

      const json = await res.json();
      const dataObj = json.data || json;
      
      let rawList: any[] = [];
      if (Array.isArray(dataObj.products)) {
        rawList = dataObj.products;
      } else if (Array.isArray(dataObj)) {
        rawList = dataObj;
      } else if (Array.isArray(json.products)) {
        rawList = json.products;
      }

      const totalFromApi = Number(dataObj.total || json.total || rawList.length);
      const pagesFromApi = Number(dataObj.pages || json.pages || Math.ceil(totalFromApi / limit));

        const seenIds = new Set<string>();
        const products: RolemallProduct[] = [];

        for (const item of rawList) {
          const normalized = normalizeProduct(item, memoryCache.categoryMap);
          if (normalized && !seenIds.has(String(normalized.id))) {
            seenIds.add(String(normalized.id));
            const entry = {
              data: normalized,
              timestamp: Date.now(),
            };
            // Cache individual product for quick details lookup (RAM + Disk)
            memoryCache.productDetails.set(String(normalized.id), entry);
            setDiskCache(`product_${normalized.id}`, entry);
            products.push(normalized);
          }
        }

        const hasMore = page < pagesFromApi && products.length >= limit;

        const result: ProductsResponse = {
          products,
          total: totalFromApi,
          page,
          limit,
          hasMore,
        };

        const resultEntry = {
          data: result,
          timestamp: Date.now(),
        };
        memoryCache.products.set(cacheKey, resultEntry);
        // Only persist real results, never an empty list
        // (search queries stay local only, so the shared cache doesn't fill up with random searches)
        if (products.length > 0 && !query) {
          await setPersistedCache(`products_${cacheKey}`, resultEntry);
        }

        return result;
    } catch (err: any) {
      console.warn(`Notice: Serving cached/fallback products due to API issue:`, err?.message || err);
      
      // Supplier failed: serve the last known good list, however old
      if (cached) {
        return cached.data;
      }

      // If this exact page was never cached, build it from everything we have:
      // cached lists in memory + the full-catalog snapshot from the hourly sync
      const snapshot = await loadCatalogSnapshot();
      if (memoryCache.products.size > 0 || snapshot.length > 0) {
        const allCachedProducts: RolemallProduct[] = [];
        const seen = new Set<string>();
        for (const p of snapshot) {
          if (!seen.has(String(p.id))) {
            seen.add(String(p.id));
            allCachedProducts.push(p);
          }
        }
        for (const entry of memoryCache.products.values()) {
          for (const p of entry.data.products) {
            if (!seen.has(String(p.id))) {
              seen.add(String(p.id));
              allCachedProducts.push(p);
            }
          }
        }

        let filtered = allCachedProducts;
        if (category) {
          filtered = filtered.filter(p => String(p.category_id) === category || p.category === category);
        }
        if (query) {
          const q = query.toLowerCase();
          filtered = filtered.filter(p => p.title.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
        }

        if (filtered.length > 0) {
          return {
            products: filtered.slice((page - 1) * limit, page * limit),
            total: filtered.length,
            page,
            limit,
            hasMore: page * limit < filtered.length,
          };
        }
      }
    }

    return {
      products: [],
      total: 0,
      page,
      limit,
      hasMore: false,
    };
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

export interface ProductDetailsResult {
  product: RolemallProduct | null;
  status: 'found' | 'not_found' | 'temporarily_unavailable';
}

/**
 * Internal singleflight fetcher for Product Details from Rolemall API
 */
async function fetchProductDetailsDirect(pId: string, allowRescue = true): Promise<ProductDetailsResult> {
  const reqKey = `detail_${pId}${allowRescue ? '' : '_norescue'}`;
  if (inFlightRequests.has(reqKey)) {
    return inFlightRequests.get(reqKey);
  }

  const fetchPromise = (async (): Promise<ProductDetailsResult> => {
    // Populate category mapping in background without blocking product details fetch
    if (memoryCache.categoryMap.size === 0 && !memoryCache.categories) {
      getCategories().catch(() => []);
    }

    let isExplicitlyNotFound = false;

    try {
      // NOTE: Rolemall's dedicated single-product endpoint. Confirmed correct by
      // cross-checking against a reference project using the same API token,
      // which fetches products reliably via this exact URL pattern (unlike the
      // old /products?id= approach, which Rolemall does not actually filter by).
      const url = `${BASE_URL}/product-details?strung=${SUPPLIER_API_TOKEN}gootquality${encodeURIComponent(pId)}`;
      const res = await resilientFetch(url, 2);

      if (res.ok) {
        const json = await res.json();
        let rawProduct: any = null;

        if (json.data && json.data.product) {
          rawProduct = json.data.product;
        } else if (json.data && !Array.isArray(json.data)) {
          rawProduct = json.data;
        } else if (json.product) {
          rawProduct = json.product;
        } else if (json && !Array.isArray(json) && (json._id || json.id)) {
          // Response might be the raw product object directly at the root
          rawProduct = json;
        }

        if (rawProduct) {
          const normalized = normalizeProduct(rawProduct, memoryCache.categoryMap);
          if (normalized) {
            const entry = {
              data: normalized,
              timestamp: Date.now(),
            };
            memoryCache.productDetails.set(pId, entry);
            await setPersistedCache(`product_${pId}`, entry);
            return { product: normalized, status: 'found' };
          }
        }
        // Got a valid 200 response but couldn't extract a usable product from it
        isExplicitlyNotFound = true;
      } else if (res.status === 404) {
        isExplicitlyNotFound = true;
      }
    } catch (err: any) {
      console.warn(`Notice: Details fetch issue for product ${pId}:`, err?.message || err);
    }

    // Rescue: Rolemall's id= filter is unreliable — it often ignores the id parameter
    // and returns its default first-page batch instead of the specific product.
    // So if the direct id-based query failed to find the product, search through
    // the full catalog page by page as a real fallback (not just memory cache).
    let rescueFound: RolemallProduct | null = null;
    const RESCUE_PAGE_LIMIT = 100;
    const RESCUE_MAX_PAGES = 15; // covers up to 1500 products

    // "Not found" is only trusted after scanning the whole catalog successfully;
    // an interrupted scan (network/rate limit) means "temporarily unavailable" instead.
    let scanComplete = false;
    if (isExplicitlyNotFound && allowRescue) {
      for (let rescuePage = 1; rescuePage <= RESCUE_MAX_PAGES && !rescueFound; rescuePage++) {
        try {
          const rescueParams = new URLSearchParams();
          rescueParams.set('token', SUPPLIER_API_TOKEN);
          rescueParams.set('limit', String(RESCUE_PAGE_LIMIT));
          rescueParams.set('page', String(rescuePage));

          const rescueUrl = `${BASE_URL}/products?${rescueParams.toString()}`;
          const rescueRes = await resilientFetch(rescueUrl, 1);
          if (!rescueRes.ok) break;

          const rescueJson = await rescueRes.json();
          const rescueDataObj = rescueJson.data || rescueJson;
          const rescueList = Array.isArray(rescueDataObj.products) ? rescueDataObj.products : (Array.isArray(rescueDataObj) ? rescueDataObj : []);

          if (rescueList.length === 0) {
            scanComplete = true;
            break;
          }

          const rescueRaw = rescueList.find((p: any) => String(p._id || p.id) === pId);
          if (rescueRaw) {
            const normalizedRescue = normalizeProduct(rescueRaw, memoryCache.categoryMap);
            if (normalizedRescue) {
              rescueFound = normalizedRescue;
            }
          }

          if (rescueList.length < RESCUE_PAGE_LIMIT) {
            scanComplete = true;
            break;
          }
        } catch (rescuePageErr: any) {
          console.warn(`Notice: Rescue page ${rescuePage} fetch failed for product ${pId}:`, rescuePageErr?.message || rescuePageErr);
          break;
        }
      }
    }

    if (rescueFound) {
      const entry = { data: rescueFound, timestamp: Date.now() };
      memoryCache.productDetails.set(pId, entry);
      await setPersistedCache(`product_${pId}`, entry);
      return { product: rescueFound, status: 'found' };
    }

    // Fallback: search across all cached product lists in memory or disk
    for (const entry of memoryCache.products.values()) {
      const found = entry.data.products.find(p => String(p.id) === pId);
      if (found) {
        return { product: found, status: 'found' };
      }
    }

    if (isExplicitlyNotFound && scanComplete) {
      // Confirmed gone at the supplier: remove every saved copy so it can't be shown or ordered
      await purgeProduct(pId);
      return { product: null, status: 'not_found' };
    }

    // Supplier unreachable: use the full-catalog snapshot (last known product & price)
    const fromSnapshot = (await loadCatalogSnapshot()).find((p) => String(p.id) === pId);
    if (fromSnapshot) {
      return { product: fromSnapshot, status: 'found' };
    }

    return { product: null, status: 'temporarily_unavailable' };
  })();

  inFlightRequests.set(reqKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightRequests.delete(reqKey);
  }
}

/**
 * Triggers background revalidation for stale product details (Stale-While-Revalidate)
 */
function triggerProductDetailsBackgroundRefresh(pId: string): void {
  const reqKey = `detail_${pId}`;
  if (!inFlightRequests.has(reqKey)) {
    fetchProductDetailsDirect(pId).catch((err) => {
      console.warn(`Background revalidation notice for product ${pId}:`, err?.message || err);
    });
  }
}

/**
 * Fetch Product Details with Multi-Tier Caching (Memory + Persistent Disk) & Stale-While-Revalidate
 */
async function getRolemallProductDetails(productId: string | number): Promise<ProductDetailsResult> {
  const pId = String(productId).trim();
  if (!pId || !VALID_PRODUCT_ID.test(pId)) return { product: null, status: 'not_found' };

  const now = Date.now();

  // Recently confirmed missing: answer instantly without touching the API
  const missingSince = notFoundCache.get(pId);
  if (missingSince && now - missingSince < NOT_FOUND_TTL_MS) {
    return { product: null, status: 'not_found' };
  }

  // Tier 1: Check In-Memory RAM Cache (Instant ~0.05ms)
  let cached = memoryCache.productDetails.get(pId);

  // Tier 2: Check Persistent Disk Cache (Instant ~1-3ms, survives restarts/cold starts)
  if (!cached) {
    const diskEntry = await getPersistedCache<RolemallProduct>(`product_${pId}`);
    if (diskEntry) {
      cached = diskEntry;
      memoryCache.productDetails.set(pId, diskEntry);
    }
  }

  // 1. Fresh Cache Hit (< 15 mins): Return immediately with 0 delay
  if (cached && (now - cached.timestamp < FRESH_TTL_MS)) {
    return { product: cached.data, status: 'found' };
  }

  // 2. Stale Cache Hit (< 24 hours): Return cached data immediately & trigger background revalidation
  if (cached && (now - cached.timestamp < STALE_TTL_MS)) {
    triggerProductDetailsBackgroundRefresh(pId);
    return { product: cached.data, status: 'found' };
  }

  // 3. Cache Miss: Fetch synchronously via Singleflight
  let fetchResult = await fetchProductDetailsDirect(pId);
  if (fetchResult.status === 'found' && fetchResult.product) {
    return fetchResult;
  }

  // Short retry only for temporary failures (network / 5xx), never for a confirmed "not found",
  // and without repeating the expensive full-catalog rescue scan.
  if (fetchResult.status === 'temporarily_unavailable') {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const retryFetch = await fetchProductDetailsDirect(pId, false);
    if (retryFetch.status === 'found' && retryFetch.product) {
      return retryFetch;
    }
    fetchResult = retryFetch;
  }

  // 4. Final Fallback: supplier temporarily unreachable -> serve the older copy (last known price).
  //    Never for a confirmed "not found": a product removed at the supplier must disappear.
  if (cached && fetchResult.status === 'temporarily_unavailable') {
    return { product: cached.data, status: 'found' };
  }

  if (fetchResult.status === 'not_found') {
    notFoundCache.set(pId, Date.now());
    // Keep the negative cache bounded
    if (notFoundCache.size > 5000) {
      for (const [key, ts] of notFoundCache) {
        if (Date.now() - ts > NOT_FOUND_TTL_MS) notFoundCache.delete(key);
      }
    }
  }

  return fetchResult;
}


// ===========================================================================
// Public catalog API: Rolemall products + manual products from the dashboard
// ===========================================================================

/**
 * Product list. Manual products are shown first on page 1 of the main listing
 * (and in search results when they match). Category pages show Rolemall only,
 * since manual products have no supplier category.
 */
export async function getProducts(options: {
  page?: number;
  limit?: number;
  category?: string;
  query?: string;
} = {}): Promise<ProductsResponse> {
  const page = Math.max(1, Number(options.page || 1));
  const category = (options.category || '').trim();
  const query = (options.query || '').trim().toLowerCase();

  const includeManual = page === 1 && !category;
  const [rolemall, manualRows] = await Promise.all([
    getRolemallProducts(options),
    includeManual ? listActiveManualProducts().catch(() => []) : Promise.resolve([]),
  ]);

  if (manualRows.length === 0) return rolemall;

  let manual = manualRows.map(manualRowToProduct);
  if (query) {
    manual = manual.filter(
      (p) => p.title.toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query)
    );
  }
  if (manual.length === 0) return rolemall;

  const manualIds = new Set(manual.map((p) => String(p.id)));
  return {
    ...rolemall,
    products: [...manual, ...rolemall.products.filter((p) => !manualIds.has(String(p.id)))],
    total: (rolemall.total || rolemall.products.length) + manual.length,
  };
}

/** Product details for either a Rolemall id or a manual id (m-123). */
export async function getProductDetails(productId: string | number): Promise<ProductDetailsResult> {
  const manualId = parseManualId(productId);
  if (manualId !== null) {
    const { row, failed } = await getManualProduct(manualId);
    if (row && row.is_active) return { product: manualRowToProduct(row), status: 'found' };
    if (failed) return { product: null, status: 'temporarily_unavailable' };
    return { product: null, status: 'not_found' };
  }
  return getRolemallProductDetails(productId);
}


// ===========================================================================
// Hourly full-catalog sync (called by netlify/functions/sync-catalog.ts)
// ===========================================================================

const SYNC_PAGE_LIMIT = 100;
const SYNC_MAX_PAGES = 40; // up to 4000 products
const SYNC_CONCURRENCY = 4;

async function fetchCatalogPage(page: number): Promise<{ items: any[]; pages: number } | null> {
  const params = new URLSearchParams();
  params.set('token', SUPPLIER_API_TOKEN);
  params.set('limit', String(SYNC_PAGE_LIMIT));
  params.set('page', String(page));
  const res = await resilientFetch(`${BASE_URL}/products?${params.toString()}`, 1);
  if (!res.ok) return null;
  const json = await res.json();
  const dataObj = json.data || json;
  const items = Array.isArray(dataObj.products) ? dataObj.products : Array.isArray(dataObj) ? dataObj : [];
  const total = Number(dataObj.total || json.total || 0);
  const pages = Number(dataObj.pages || json.pages || (total ? Math.ceil(total / SYNC_PAGE_LIMIT) : 0));
  return { items, pages };
}

export interface CatalogSyncResult {
  ok: boolean;
  products: number;
  pages: number;
  reason?: string;
}

/**
 * Downloads every Rolemall product and saves:
 * - catalog_all: the full list (fallback for any page, category, search or product)
 * - product_<id>: one row per product (fast product pages)
 * Refuses to overwrite a good snapshot with an empty or suspiciously small one.
 */
export async function syncFullCatalog(): Promise<CatalogSyncResult> {
  if (!SUPPLIER_API_TOKEN) return { ok: false, products: 0, pages: 0, reason: 'ROLEMALL_API_TOKEN missing' };

  const categories = await getCategories().catch(() => []);
  if (categories.length === 0 && memoryCache.categoryMap.size === 0) {
    // Names only; products still sync without them
    console.warn('[sync] categories unavailable, continuing without category names');
  }

  const first = await fetchCatalogPage(1).catch(() => null);
  if (!first || first.items.length === 0) {
    return { ok: false, products: 0, pages: 0, reason: 'Rolemall unavailable or empty' };
  }

  const totalPages = Math.min(
    SYNC_MAX_PAGES,
    first.pages > 0 ? first.pages : first.items.length < SYNC_PAGE_LIMIT ? 1 : SYNC_MAX_PAGES
  );

  const rawItems: any[] = [...first.items];
  let failedPages = 0;
  let reachedEnd = first.items.length < SYNC_PAGE_LIMIT;

  for (let start = 2; start <= totalPages && !reachedEnd; start += SYNC_CONCURRENCY) {
    const batch: number[] = [];
    for (let p = start; p < start + SYNC_CONCURRENCY && p <= totalPages; p++) batch.push(p);
    const results = await Promise.all(batch.map((p) => fetchCatalogPage(p).catch(() => null)));
    for (const r of results) {
      if (!r) {
        failedPages++;
        continue;
      }
      rawItems.push(...r.items);
      if (r.items.length < SYNC_PAGE_LIMIT) reachedEnd = true;
    }
  }

  if (failedPages > 0) {
    // A partial download would drop products from the snapshot: keep the previous one
    return { ok: false, products: rawItems.length, pages: totalPages, reason: `${failedPages} page(s) failed` };
  }

  const seen = new Set<string>();
  const products: RolemallProduct[] = [];
  for (const raw of rawItems) {
    const p = normalizeProduct(raw, memoryCache.categoryMap);
    if (p && !seen.has(String(p.id))) {
      seen.add(String(p.id));
      products.push(p);
    }
  }

  if (products.length === 0) {
    return { ok: false, products: 0, pages: totalPages, reason: 'no valid products' };
  }

  const previous = await kvGet<RolemallProduct[]>(CATALOG_KEY);
  const previousCount = Array.isArray(previous?.data) ? previous!.data.length : 0;
  if (previousCount > 20 && products.length < previousCount * 0.3) {
    return {
      ok: false,
      products: products.length,
      pages: totalPages,
      reason: `only ${products.length} products vs ${previousCount} last time; keeping previous snapshot`,
    };
  }

  const now = Date.now();
  const catalogOk = await kvSetMany([{ key: CATALOG_KEY, data: products }], now);
  if (catalogOk && previousCount > 0) {
    // Products that disappeared from the supplier since the last sync: delete their saved pages
    const currentIds = new Set(products.map((p) => String(p.id)));
    const removedKeys = previous!.data
      .map((p) => String(p.id))
      .filter((id) => !currentIds.has(id))
      .map((id) => `product_${id}`);
    if (removedKeys.length > 0) {
      await kvDeleteMany(removedKeys);
      removedKeys.forEach((k) => memoryCache.productDetails.delete(k.slice('product_'.length)));
      console.log(`[sync] Removed ${removedKeys.length} product(s) no longer at the supplier`);
    }
  }
  if (!catalogOk) return { ok: false, products: products.length, pages: totalPages, reason: 'saving catalog failed' };

  // Per-product rows in chunks
  const rows = products.map((p) => ({ key: `product_${p.id}`, data: p }));
  const CHUNK = 250;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await kvSetMany(rows.slice(i, i + CHUNK), now);
  }

  catalogSnapshot = { products, loadedAt: now };
  return { ok: true, products: products.length, pages: totalPages };
}
