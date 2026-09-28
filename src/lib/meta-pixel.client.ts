/**
 * Meta Pixel Client Integration
 * Handles safe client-side initialization, Advanced Matching, cookie retrieval & event tracking
 */

import { normalizeDigits } from './phone';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

let isInitialized = false;
let currentPixelId = '';
let currentIqdToUsdRate = 1400;

/**
 * Retrieve _fbp and _fbc from browser cookies or query parameters
 */
export function getMetaCookies(): { fbp?: string; fbc?: string } {
  if (typeof window === 'undefined') return {};

  let fbp: string | undefined;
  let fbc: string | undefined;

  try {
    // 1. Read document.cookie for _fbp and _fbc
    const rawCookie = document.cookie || '';
    const cookiePairs = rawCookie.split(';');

    for (const pair of cookiePairs) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) continue;

      const key = trimmed.substring(0, equalIndex).trim();
      const val = trimmed.substring(equalIndex + 1).trim();

      if (key === '_fbp' && val && val.startsWith('fb.')) {
        fbp = val;
      } else if (key === '_fbc' && val && val.startsWith('fb.')) {
        fbc = val;
      }
    }

    // 2. If _fbc is not found in document.cookie, check current URL or sessionStorage for fbclid
    if (!fbc) {
      const searchParams = new URLSearchParams(window.location.search);
      const fbclid = searchParams.get('fbclid');

      if (fbclid) {
        // Standard Meta Click ID format: fb.1.<creation_time>.<fbclid>
        const timestamp = Date.now();
        fbc = `fb.1.${timestamp}.${fbclid}`;
        try {
          sessionStorage.setItem('_meta_fbc', fbc);
        } catch {
          // Ignore storage restrictions
        }
      } else {
        try {
          const storedFbc = sessionStorage.getItem('_meta_fbc');
          if (storedFbc && storedFbc.startsWith('fb.')) {
            fbc = storedFbc;
          }
        } catch {
          // Ignore storage restrictions
        }
      }
    }
  } catch {
    // Graceful fallback
  }

  const result: { fbp?: string; fbc?: string } = {};
  if (fbp) result.fbp = fbp;
  if (fbc) result.fbc = fbc;
  return result;
}

/**
 * Initialize Meta Pixel and capture initial fbclid if present
 */
export async function initMetaPixel(): Promise<void> {
  if (typeof window === 'undefined' || isInitialized) return;

  try {
    // Capture fbclid immediately on initial landing
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const fbclid = searchParams.get('fbclid');
      if (fbclid) {
        sessionStorage.setItem('_meta_fbc', `fb.1.${Date.now()}.${fbclid}`);
      }
    } catch {
      // Ignore storage restrictions
    }

    const res = await fetch('/api/meta-config');
    if (!res.ok) return;

    const data = await res.json();
    const pixelId = data.pixelId;

    if (data.iqdToUsdRate && typeof data.iqdToUsdRate === 'number') {
      currentIqdToUsdRate = data.iqdToUsdRate;
    }

    if (!pixelId) return;
    currentPixelId = pixelId;

    /* eslint-disable */
    (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return;

      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };

      if (!f._fbq) f._fbq = n;

      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];

      t = b.createElement(e);
      t.async = !0;
      t.src = v;

      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */

    if (window.fbq) {
      window.fbq('init', pixelId);
      window.fbq('track', 'PageView');

      // Debug only — does not send another event
      console.log(`[Meta Pixel] Tracked PageView (Pixel ID: ${pixelId})`);

      isInitialized = true;
    }
  } catch {
    // Fail silently in development or when blocked
  }
}

export function trackMetaEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  eventId?: string
): void {
  if (typeof window === 'undefined' || !window.fbq || !isInitialized) return;

  try {
    if (eventId) {
      window.fbq('track', eventName, params, { eventID: eventId });
    } else {
      window.fbq('track', eventName, params);
    }

    // Debug only — does not send another event
    console.log(
      `[Meta Pixel] Tracked ${eventName}${eventId ? ` (ID: ${eventId})` : ''}`,
      params
    );
  } catch {
    // Ignore tracking errors
  }
}

/**
 * Fire-and-forget dispatch to our server-side /track endpoint, giving ViewContent
 * and InitiateCheckout server-side CAPI coverage (resilient to browser ad-blockers),
 * matching the same reliability level Purchase already has via sendMetaCapiPurchase.
 * No customer identity (name/phone) is available yet at this stage — only browser-level
 * signals (fbc, fbp, IP, User-Agent), which is expected and correct for these early events.
 */
function sendServerCapiEarlyEvent(
  eventName: 'ViewContent' | 'InitiateCheckout',
  productId: string | number,
  productName: string,
  priceIqd: number,
  count: number
): void {
  if (typeof window === 'undefined') return;
  try {
    const { fbp, fbc } = getMetaCookies();
    const eventId = `evt_${eventName}_${productId}_${Date.now()}`;
    fetch('/.netlify/functions/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        eventId,
        productId,
        productName,
        priceIqd,
        count,
        sourceUrl: window.location.href,
        fbc,
        fbp,
      }),
      keepalive: true,
    }).catch(() => {
      // Silent fail — this is a best-effort tracking call, never block the user
    });
  } catch {
    // Ignore
  }
}

export function trackViewContent(product: {
  id: string | number;
  title: string;
  price: number;
}): void {
  const usdValue = Number((product.price / currentIqdToUsdRate).toFixed(2));

  trackMetaEvent('ViewContent', {
    content_ids: [String(product.id)],
    content_name: product.title,
    content_type: 'product',
    value: usdValue,
    currency: 'USD',
  });

  sendServerCapiEarlyEvent('ViewContent', product.id, product.title, product.price, 1);
}

export function trackAddToCart(product: {
  id: string | number;
  title: string;
  price: number;
  count: number;
}): void {
  const usdValue = Number(((product.price * product.count) / currentIqdToUsdRate).toFixed(2));

  trackMetaEvent('AddToCart', {
    content_ids: [String(product.id)],
    content_name: product.title,
    content_type: 'product',
    value: usdValue,
    currency: 'USD',
    num_items: product.count,
  });
}

export function trackInitiateCheckout(product: {
  id: string | number;
  title: string;
  price: number;
  count: number;
}): void {
  const usdValue = Number(((product.price * product.count) / currentIqdToUsdRate).toFixed(2));

  trackMetaEvent('InitiateCheckout', {
    content_ids: [String(product.id)],
    content_name: product.title,
    content_type: 'product',
    value: usdValue,
    currency: 'USD',
    num_items: product.count,
  });

  sendServerCapiEarlyEvent('InitiateCheckout', product.id, product.title, product.price, product.count);
}

/**
 * Track Purchase event with Browser Advanced Matching (fn, ph) and deduplication eventID
 */
export function trackPurchase(order: {
  orderId: string;
  productId: string | number;
  productName: string;
  totalPrice: number;
  count: number;
  customerName?: string;
  phone?: string;
}): void {
  const usdValue = Number((order.totalPrice / currentIqdToUsdRate).toFixed(2));
  const eventId = order.orderId;

  if (typeof window !== 'undefined' && window.fbq && isInitialized) {
    try {
      // Apply Advanced Matching with fn and ph if available
      if (currentPixelId && (order.customerName || order.phone)) {
        const advancedMatching: Record<string, string> = {};

        if (order.customerName) {
          const cleanName = order.customerName.trim().replace(/\s+/g, ' ').toLowerCase();

          if (cleanName) {
            advancedMatching.fn = cleanName;
          }
        }

        if (order.phone) {
          let cleanDigits = normalizeDigits(order.phone);

          if (cleanDigits.startsWith('07')) {
            cleanDigits = '964' + cleanDigits.substring(1);
          } else if (cleanDigits.startsWith('7') && cleanDigits.length === 10) {
            cleanDigits = '964' + cleanDigits;
          } else if (cleanDigits.startsWith('009647')) {
            cleanDigits = '9647' + cleanDigits.substring(6);
          }

          if (cleanDigits) {
            advancedMatching.ph = cleanDigits;
          }
        }

        if (Object.keys(advancedMatching).length > 0) {
          window.fbq('init', currentPixelId, advancedMatching);
        }
      }

      const purchaseParams = {
        content_ids: [String(order.productId)],
        content_name: order.productName,
        content_type: 'product',
        value: usdValue,
        currency: 'USD',
        num_items: order.count,
      };

      window.fbq(
        'track',
        'Purchase',
        purchaseParams,
        { eventID: eventId }
      );

      // Debug only — does not send another event
      console.log(
        `[Meta Pixel] Tracked Purchase (ID: ${eventId})`,
        {
          ...purchaseParams,
          event_id: eventId,
        }
      );
    } catch {
      // Ignore tracking errors
    }
  }
}
