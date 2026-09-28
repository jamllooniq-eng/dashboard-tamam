import type { Handler } from '@netlify/functions';
import { getProducts } from '../../server/rolemall.server';
import { RolemallProduct } from '../../src/types';
/**
 * Meta (Facebook/Instagram) Catalog Feed — XML (RSS 2.0 + g: namespace)
 * Docs: https://www.facebook.com/business/help/120325381656392
 *
 * Exposed at: /feed.xml  (see netlify.toml redirect)
 * Add this exact URL as the "Data Feed" source in Meta Commerce Manager.
 */
function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
function cdata(value: string): string {
  const safe = String(value ?? '').replace(/]]>/g, ']]]]><![CDATA[>');
  return `<![CDATA[${safe}]]>`;
}

// ============ إضافة: جلب خريطة الفيديو من جيتهاب وقت الطلب ============
// نجيب video-map.json مباشرة من جيتهاب في كل مرة يُطلب فيها الفيد، بدل ما
// نضمّنه وقت بناء الموقع. هذا يعني إن تحديث الفيديوهات (اللي يسويه سكريبت
// تيليجرام تلقائيًا) ما يحتاج نشر جديد للموقع إطلاقًا — بس يحدّث الملف
// بجيتهاب وفيد ميتا يجيب آخر نسخة منه فورًا بالطلب التالي.
//
// اضبط VIDEO_MAP_URL بمتغيرات بيئة Netlify ليشير لرابط الملف الخام (Raw)
// بمستودعك، مثال:
// https://raw.githubusercontent.com/USERNAME/REPO/main/video-map.json
const VIDEO_MAP_URL = process.env.VIDEO_MAP_URL || '';

// كاش بسيط بالذاكرة لمدة 10 دقائق، حتى ما نضغط على جيتهاب بكل طلب
let videoMapCache: { data: Record<string, string | string[]>; fetchedAt: number } | null = null;
const VIDEO_MAP_CACHE_TTL_MS = 10 * 60 * 1000; // 10 دقائق

async function fetchVideoMap(): Promise<Record<string, string | string[]>> {
  if (!VIDEO_MAP_URL) return {};

  const now = Date.now();
  if (videoMapCache && now - videoMapCache.fetchedAt < VIDEO_MAP_CACHE_TTL_MS) {
    return videoMapCache.data;
  }

  try {
    const res = await fetch(VIDEO_MAP_URL, { cache: 'no-store' as any });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, string | string[]>;
    videoMapCache = { data, fetchedAt: now };
    return data;
  } catch (err) {
    console.error('Error fetching video-map.json from GitHub:', err);
    // لو فشل الجلب (مثلاً الملف مو موجود بعد)، نرجع كاش قديم لو موجود
    // وإلا نرجع فاضي بدون ما نكسر الفيد كامل.
    return videoMapCache?.data || {};
  }
}
// ========================================================================

// Fetch ALL products from Rolemall by walking through every page
async function fetchAllProducts(): Promise<RolemallProduct[]> {
  const all: RolemallProduct[] = [];
  const limit = 100;
  let page = 1;
  const MAX_PAGES = 50; // safety cap (5000 products)
  while (page <= MAX_PAGES) {
    const result = await getProducts({ page, limit });
    if (!result.products || result.products.length === 0) break;
    all.push(...result.products);
    if (!result.hasMore) break;
    page++;
  }
  return all;
}
export const handler: Handler = async () => {
  try {
    const baseUrl = process.env.APP_URL || 'https://tamam-iq.com';
    const products = await fetchAllProducts();
    const videoMap = await fetchVideoMap();
    const items = products
      .filter((p) => p.title && p.price > 0 && p.image)
      .map((p) => {
        const link = `${baseUrl}/product/${encodeURIComponent(String(p.id))}`;
        const availability = p.available === false ? 'out of stock' : 'in stock';
        const description = (p.description || p.title || '').replace(/<[^>]*>/g, '').slice(0, 5000);
        const extraImages = (p.images || [])
          .filter((img) => img && img !== p.image)
          .slice(0, 10)
          .map((img) => `      <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`)
          .join('\n');
        // ملاحظة: الصيغة الرسمية من ميتا لحقل الفيديو هي <video><url>...</url></video>
        // (مو <g:video_link> الشائع بأدوات ثالثة) — راجع:
        // developers.facebook.com/docs/marketing-api/advantage-catalog-ads/dynamic-media
        // videoMap[id] ممكن يكون رابط واحد (نص) أو أكثر من رابط (قائمة نصوص).
        const rawVideo = videoMap[String(p.id)];
        const videoUrls: string[] = Array.isArray(rawVideo)
          ? rawVideo
          : rawVideo
          ? [rawVideo]
          : [];
        const videoTag = videoUrls.length
          ? '\n' +
            videoUrls
              .map((url) => `      <video>\n        <url>${escapeXml(url)}</url>\n      </video>`)
              .join('\n')
          : '';
        return `    <item>
      <g:id>${escapeXml(String(p.id))}</g:id>
      <title>${cdata(p.title)}</title>
      <description>${cdata(description)}</description>
      <link>${escapeXml(link)}</link>
      <g:image_link>${escapeXml(p.image)}</g:image_link>
${extraImages}${videoTag}
      <g:availability>${availability}</g:availability>
      <g:condition>new</g:condition>
      <g:price>${p.price} IQD</g:price>${p.old_price ? `\n      <g:sale_price>${p.price} IQD</g:sale_price>` : ''}
      <g:brand>${cdata(p.vendor || 'تمام شوب')}</g:brand>
      ${p.category ? `<g:product_type>${cdata(p.category)}</g:product_type>` : ''}
      ${p.sku ? `<g:mpn>${escapeXml(p.sku)}</g:mpn>` : ''}
    </item>`;
      })
      .join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>تمام شوب - كتالوج المنتجات</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Product catalog feed for Meta Commerce Manager</description>
${items}
  </channel>
</rss>`;
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=7200',
      },
      body: xml,
    };
  } catch (err: any) {
    console.error('Error generating Meta feed:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Error generating feed',
    };
  }
};
