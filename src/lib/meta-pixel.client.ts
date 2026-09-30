/**
 * Meta Pixel Client Integration
 * Handles safe client-side initialization, Advanced Matching, cookie retrieval & event tracking
 */

import { normalizeDigits } from './phone';
import { initTikTokPixel, trackTikTokEvent, captureTikTokClickId, getTikTokIds } from './tiktok-pixel.client';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

let isInitialized = false;
let currentPixelId = '';
let currentIqdToUsdRate = 1400;

// Tracking config is fetched once (/api/meta-config). Events fired before it arrives
// (e.g. ViewContent right when an ad visitor lands) wait for it instead of being dropped.
let initPromise: Promise<void> | null = null;
let configLoaded = false;

// ---- External ID: one random, anonymous ID per visitor, kept on the phone ----
// Sent hashed (SHA-256) by BOTH the browser pixel and the server, so Meta can link a visitor's
// ViewContent -> InitiateCheckout -> Purchase and match them better. Contains no personal data.
const VISITOR_ID_KEY = 'tamam_vid';
let externalIdHash: string | null = null;

async function computeExternalId(): Promise<string | null> {
  if (externalIdHash) return externalIdHash;
  try {
    let vid = localStorage.getItem(VISITOR_ID_KEY);
    if (!vid) {
      vid =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VISITOR_ID_KEY, vid);
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(vid));
    externalIdHash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return externalIdHash;
  } catch {
    return null; // storage or crypto unavailable: simply no external_id
  }
}

/** Hashed visitor ID (available once the pixel config has loaded). */
export function getExternalId(): string | undefined {
  return externalIdHash || undefined;
}

function whenTrackingReady(fn: () => void): void {
  if (typeof window === 'undefined') return;
  if (configLoaded || !initPromise) {
    fn();
    return;
  }
  initPromise.then(fn, fn);
}

/**
 * One ID per customer action, shared by the browser pixel (eventID) and the
 * server copy (event_id) so Meta — and TikTok later — count the action once.
 */
function newEventId(eventName: string, productId: string | number): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${eventName}_${String(productId).replace(/[^A-Za-z0-9-]/g, '')}_${Date.now()}_${rand}`;
}

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
 * Initialize Meta Pixel (and TikTok Pixel if configured) and capture click ids.
 * Safe to call more than once: the config is fetched a single time.
 */
export function initMetaPixel(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!initPromise) {
    initPromise = runPixelInit().finally(() => {
      configLoaded = true;
    });
  }
  return initPromise;
}

async function runPixelInit(): Promise<void> {
  if (isInitialized) return;

  captureTikTokClickId();
  await computeExternalId();

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

    // TikTok is independent from Meta and stays off unless TIKTOK_PIXEL_ID is set
    if (typeof data.tiktokPixelId === 'string' && data.tiktokPixelId.trim()) {
      initTikTokPixel(data.tiktokPixelId.trim());
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
      if (externalIdHash) {
        window.fbq('init', pixelId, { external_id: externalIdHash });
      } else {
        window.fbq('init', pixelId);
      }
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
  if (typeof window === 'undefined') return;

  whenTrackingReady(() => {
    if (!window.fbq || !isInitialized) return;
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
  });
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
  eventId: string,
  productId: string | number,
  productName: string,
  priceIqd: number,
  count: number
): void {
  if (typeof window === 'undefined') return;
  // Wait for the tracking config so the external_id is ready (a fraction of a second on first load)
  whenTrackingReady(() => sendServerCapiEarlyEventNow(eventName, eventId, productId, productName, priceIqd, count));
}

function sendServerCapiEarlyEventNow(
  eventName: 'ViewContent' | 'InitiateCheckout',
  eventId: string,
  productId: string | number,
  productName: string,
  priceIqd: number,
  count: number
): void {
  try {
    const { fbp, fbc } = getMetaCookies();
    const { ttp, ttclid } = getTikTokIds();
    fetch('/.netlify/functions/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        eventId, // same ID as the browser pixel event -> deduplicated
        productId,
        productName,
        priceIqd,
        count,
        sourceUrl: window.location.href,
        fbc,
        fbp,
        ttp,
        ttclid,
        externalId: getExternalId(),
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
  const eventId = newEventId('ViewContent', product.id);

  trackMetaEvent(
    'ViewContent',
    {
      content_ids: [String(product.id)],
      content_name: product.title,
      content_type: 'product',
      value: usdValue,
      currency: 'USD',
    },
    eventId
  );

  sendServerCapiEarlyEvent('ViewContent', eventId, product.id, product.title, product.price, 1);

  whenTrackingReady(() => {
    const unitUsd = Number((product.price / currentIqdToUsdRate).toFixed(2));
    trackTikTokEvent(
      'ViewContent',
      { productId: product.id, productName: product.title, unitUsd, count: 1, valueUsd: unitUsd },
      eventId
    );
  });
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
  const eventId = newEventId('InitiateCheckout', product.id);

  trackMetaEvent(
    'InitiateCheckout',
    {
      content_ids: [String(product.id)],
      content_name: product.title,
      content_type: 'product',
      value: usdValue,
      currency: 'USD',
      num_items: product.count,
    },
    eventId
  );

  sendServerCapiEarlyEvent('InitiateCheckout', eventId, product.id, product.title, product.price, product.count);

  whenTrackingReady(() => {
    const unitUsd = Number((product.price / currentIqdToUsdRate).toFixed(2));
    trackTikTokEvent(
      'InitiateCheckout',
      {
        productId: product.id,
        productName: product.title,
        unitUsd,
        count: product.count,
        valueUsd: Number(((product.price * product.count) / currentIqdToUsdRate).toFixed(2)),
      },
      eventId
    );
  });
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

        if (externalIdHash) {
          advancedMatching.external_id = externalIdHash;
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
        // Same order ID the server sends: lets Meta identify each order (was missing on browser copies)
        order_id: order.orderId,
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

  // TikTok (inactive unless configured): same orderId as event_id -> deduplicated with the Events API
  trackTikTokEvent(
    'CompletePayment',
    {
      productId: order.productId,
      productName: order.productName,
      unitUsd: Number(((order.totalPrice / Math.max(1, order.count)) / currentIqdToUsdRate).toFixed(2)),
      count: order.count,
      valueUsd: usdValue,
    },
    eventId
  );
}
