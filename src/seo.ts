import { RolemallProduct, RolemallCategory } from './types';
import { getOptimizedImageUrl } from './lib/image';

export interface GenerateSeoOptions {
  view: 'home' | 'product' | '404' | 'unavailable';
  product?: RolemallProduct | null;
  category?: RolemallCategory | null;
  categoryName?: string;
  search?: string;
  baseUrl?: string;
  currentUrl?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Server-Side SEO tags generator
 * Builds <title>, meta description, OpenGraph, Twitter Cards, Canonical link, and JSON-LD structured data
 */
export function generateHeadTags(options: GenerateSeoOptions): string {
  const baseUrl = (options.baseUrl || 'https://tamam-iq.com').replace(/\/$/, '');
  const siteName = 'تمام شوب | TAMAM SHOP';
  const defaultDesc =
    'تمام شوب - وجهتك الأولى في العراق للتسوق المباشر لأحدث الأجهزة، الإلكترونيات، ولوازم المنزل مع التوصيل المجاني والدفع عند الاستلام والمعاينة.';
  const defaultImage = `${baseUrl}/og-cover.png`;

  let title = `${siteName} - متجر إلكتروني للأجهزة والمنتجات الحديثة`;
  let description = defaultDesc;
  let image = defaultImage;
  let canonicalUrl = options.currentUrl || `${baseUrl}/`;
  let ogType = 'website';
  let jsonLd: Record<string, any> | null = null;

  if (options.view === 'product' && options.product) {
    const prod = options.product;
    title = `${prod.title} | ${siteName}`;
    description = prod.description
      ? prod.description.replace(/\r?\n|\r/g, ' ').slice(0, 165).trim()
      : `اشترِ الآن ${prod.title} بأفضل سعر في العراق (${prod.price.toLocaleString('en-US')} د.ع) مع شحن مجاني ودفع عند الاستلام.`;
    image = prod.image || defaultImage;
    canonicalUrl = `${baseUrl}/product/${prod.id}`;
    ogType = 'product';

    jsonLd = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: prod.title,
      image: prod.image,
      description: description,
      sku: prod.sku || String(prod.id),
      ...(prod.vendor ? { brand: { '@type': 'Brand', name: prod.vendor } } : {}),
      offers: {
        '@type': 'Offer',
        priceCurrency: 'IQD',
        price: prod.price,
        availability: prod.available === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        url: canonicalUrl,
        seller: {
          '@type': 'Organization',
          name: 'تمام شوب (TAMAM SHOP)',
        },
      },
    };
  } else if (options.categoryName) {
    title = `${options.categoryName} - تسوق أفضل العروض | ${siteName}`;
    description = `تسوق تشكيلة واسعة من منتجات ${options.categoryName} في العراق مع توصيل مجاني ودفع عند الاستلام من متجر تمام شوب.`;
  } else if (options.search) {
    title = `نتائج البحث عن: "${options.search}" | ${siteName}`;
    description = `شاهد المنتجات والعروض المتطابقة مع بحثك عن "${options.search}" في متجر تمام شوب العراق.`;
  } else if (options.view === 'unavailable') {
    title = `تعذّر تحميل المنتج مؤقتاً | ${siteName}`;
    description = 'قد يكون هناك ضغط مؤقت على الخادم. يرجى تحديث الصفحة خلال لحظات.';
  } else if (options.view === '404') {
    title = `الصفحة غير موجودة | ${siteName}`;
    description = 'عذراً، الصفحة المطلوبة غير متوفرة أو تم نقلها.';
  }

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeCanonical = escapeHtml(canonicalUrl);

  const tags = [
    `<title>${safeTitle}</title>`,
    `<meta name="description" content="${safeDesc}" />`,
    `<link rel="canonical" href="${safeCanonical}" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`,
    `<meta property="og:title" content="${safeTitle}" />`,
    `<meta property="og:description" content="${safeDesc}" />`,
    `<meta property="og:image" content="${safeImage}" />`,
    `<meta property="og:url" content="${safeCanonical}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:locale" content="ar_IQ" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${safeTitle}" />`,
    `<meta name="twitter:description" content="${safeDesc}" />`,
    `<meta name="twitter:image" content="${safeImage}" />`,
  ];

  if (jsonLd) {
    tags.push(
      `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
    );
  }

  // Preload main product image for instant LCP on product pages
  if (options.view === 'product' && options.product?.image) {
    const proxiedImageUrl = getOptimizedImageUrl(options.product.image, { width: 800, quality: 80, fit: 'contain' });
    tags.push(`<link rel="preload" as="image" href="${escapeHtml(proxiedImageUrl)}" fetchpriority="high" />`);
  }

  return tags.join('\n    ');
}
