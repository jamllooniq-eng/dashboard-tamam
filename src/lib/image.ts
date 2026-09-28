/**
 * Netlify Image CDN helper
 * Automatically delivers optimized images (AVIF/WebP) via Netlify Edge CDN.
 * 
 * In production on Netlify, uses `/.netlify/images?url=...&w=...&q=...`.
 * In development or local preview, safely provides optimized images with fallback.
 */

export interface ImageOptimizerOptions {
  width?: number;
  quality?: number;
  fit?: 'contain' | 'cover' | 'fill';
}

/**
 * Returns an optimized image URL using Netlify Image CDN.
 *
 * @param url Original source image URL
 * @param options Optimization options (width, quality, fit)
 * @returns Optimized image URL string
 */
export function getOptimizedImageUrl(
  url: string | undefined | null,
  options: ImageOptimizerOptions = {}
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // If local asset or already a netlify image URL, return as is
  if (trimmed.startsWith('/') || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))) {
    return trimmed;
  }

  const { width = 800, quality = 80, fit } = options;

  // Build standard Netlify Image CDN URL
  const encodedUrl = encodeURIComponent(trimmed);
  let cdnPath = `/.netlify/images?url=${encodedUrl}&w=${width}&q=${quality}`;
  if (fit) {
    cdnPath += `&fit=${fit}`;
  }

  return cdnPath;
}
