/**
 * CDN cache policy for Tamam (Netlify)
 *
 * Goal: an ad click always gets a ready page from Netlify's CDN (instant open), while prices stay
 * correct because the pages of products that change are purged by tag and re-rendered right away.
 *
 * - Pages/API responses are cached in Netlify's *durable* cache (shared by all edge nodes).
 * - After max-age they are still served instantly (stale-while-revalidate) while a fresh copy is
 *   rendered in the background, so visitors never wait for the server.
 * - Every response carries cache tags; changes purge only the affected tags.
 * - If purging ever fails (e.g. expired token), max-age bounds how long a changed price can show.
 *
 * Purge needs env: NETLIFY_PURGE_API_TOKEN (secret) + TAMAM_SITE_ID (SITE_ID is reserved by Netlify).
 */

import { purgeCache } from '@netlify/functions';
import { kvGet, kvSet } from './supabase.server';
import { getOptimizedImageUrl } from '../src/lib/image';
import { GALLERY_IMAGE_WIDTHS, GALLERY_IMAGE_QUALITY } from '../src/lib/image';

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

/** Browsers always re-check with Netlify (cheap), so they never keep an old page themselves. */
export const BROWSER_CACHE = 'public, max-age=0, must-revalidate';

/** Netlify CDN: 1 hour fresh, then served instantly while refreshing in the background. */
export const CDN_CACHE = 'public, durable, max-age=3600, stale-while-revalidate=604800';

export const TAG_LISTING = 'listing';
export const TAG_PAGES = 'pages';

export function productTag(id: string | number): string {
  return `product-${String(id).toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
}

export function cachedHeaders(tags: string[]): Record<string, string> {
  return {
    'Cache-Control': BROWSER_CACHE,
    'Netlify-CDN-Cache-Control': CDN_CACHE,
    'Netlify-Cache-Tag': tags.join(','),
  };
}

// ---------------------------------------------------------------------------
// Purge
// ---------------------------------------------------------------------------

export interface PurgeStatus {
  ok: boolean;
  at: number;
  tags: number;
  error?: string;
}

const PURGE_STATUS_KEY = 'cache_purge_status';

export function isPurgeConfigured(): boolean {
  return Boolean((process.env.NETLIFY_PURGE_API_TOKEN || '').trim());
}

/** Purge the given cache tags. Never throws; records the outcome for the dashboard. */
export async function purgeTags(tags: string[]): Promise<PurgeStatus> {
  const unique = [...new Set(tags.filter(Boolean))];
  let status: PurgeStatus;
  if (unique.length === 0) return { ok: true, at: Date.now(), tags: 0 };

  if (!isPurgeConfigured()) {
    status = { ok: false, at: Date.now(), tags: unique.length, error: 'missing-token' };
  } else {
    try {
      const siteID = (process.env.TAMAM_SITE_ID || process.env.SITE_ID || '').trim() || undefined;
      await purgeCache({ tags: unique, ...(siteID ? { siteID } : {}) });
      status = { ok: true, at: Date.now(), tags: unique.length };
    } catch (err: any) {
      const message = String(err?.message || err || 'purge failed');
      console.warn('[cache] purge failed:', message);
      status = {
        ok: false,
        at: Date.now(),
        tags: unique.length,
        error: /401|403|unauthori|forbidden|token/i.test(message) ? 'token-rejected' : message.slice(0, 200),
      };
    }
  }
  await kvSet(PURGE_STATUS_KEY, status).catch(() => {});
  return status;
}

export async function getLastPurgeStatus(): Promise<PurgeStatus | null> {
  const row = await kvGet<PurgeStatus>(PURGE_STATUS_KEY, { timeoutMs: 3000, tripBreaker: false });
  return row?.data || null;
}

// ---------------------------------------------------------------------------
// Warm (render + store in the CDN before a customer arrives)
// ---------------------------------------------------------------------------

function siteOrigin(): string {
  return (process.env.APP_URL || process.env.URL || 'https://tamam-iq.com').replace(/\/+$/, '');
}

// Netlify's image CDN picks the format from the Accept header, so warm the two common variants
const IMAGE_ACCEPTS = [
  'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', // Chrome / Android
  'image/webp,image/avif,image/jxl,image/heic,image/heic-sequence,video/*;q=0.8,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5', // Safari / iPhone
];

async function fetchQuietly(url: string, headers: Record<string, string>, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TamamCacheWarmer/1.0', ...headers }, signal: controller.signal });
    await res.arrayBuffer().catch(() => undefined);
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<unknown>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export interface WarmTarget {
  path: string; // e.g. /product/12815 or /
  image?: string; // original product image URL (main image)
}

/** The exact image URLs the product gallery asks for (all responsive widths). */
export function mainImageUrls(image: string): string[] {
  if (!image) return [];
  return GALLERY_IMAGE_WIDTHS.map((w) => getOptimizedImageUrl(image, { width: w, quality: GALLERY_IMAGE_QUALITY, fit: 'contain' }));
}

/**
 * Render pages (and their main image) so the CDN holds them before customers arrive.
 * Best effort, bounded in time; never throws.
 */
export async function warmTargets(
  targets: WarmTarget[],
  options: { maxTargets?: number; delayMs?: number; deadlineMs?: number } = {}
): Promise<number> {
  const seen = new Set<string>();
  const list = targets.filter((t) => !seen.has(t.path) && seen.add(t.path)).slice(0, options.maxTargets ?? 30);
  if (list.length === 0) return 0;
  // Give a just-sent purge a moment to reach every edge node before re-filling the cache
  if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));

  const origin = siteOrigin();
  const stopAt = options.deadlineMs ? Date.now() + options.deadlineMs : Infinity;
  let warmed = 0;
  await runLimited(list, 4, async (t) => {
    if (Date.now() > stopAt) return; // stay inside the function's time limit
    const jobs: Promise<boolean>[] = [fetchQuietly(`${origin}${t.path}`, { Accept: 'text/html' }, 10000)];
    if (t.image) {
      for (const imageUrl of mainImageUrls(t.image)) {
        for (const accept of IMAGE_ACCEPTS) jobs.push(fetchQuietly(`${origin}${imageUrl}`, { Accept: accept }, 10000));
      }
    }
    const [pageOk] = await Promise.all(jobs);
    if (pageOk) warmed++;
  });
  return warmed;
}
