/**
 * TikTok Pixel (browser) — prepared for the future, inactive by default.
 *
 * The pixel script is loaded ONLY when the server config (/api/meta-config) returns a
 * non-empty tiktokPixelId (from the TIKTOK_PIXEL_ID env var). With it empty, no script
 * is loaded and every function here does nothing.
 */

declare global {
  interface Window {
    ttq?: any;
    TiktokAnalyticsObject?: string;
  }
}

let tiktokReady = false;
const TTCLID_KEY = '_tt_ttclid';

/** Keep the TikTok click id from the ad URL for the whole visit (used by the Events API). */
export function captureTikTokClickId(): void {
  if (typeof window === 'undefined') return;
  try {
    const ttclid = new URLSearchParams(window.location.search).get('ttclid');
    if (ttclid) sessionStorage.setItem(TTCLID_KEY, ttclid);
  } catch {
    // storage blocked
  }
}

/** Browser identifiers the server needs to match events to TikTok ads. */
export function getTikTokIds(): { ttp?: string; ttclid?: string } {
  if (typeof window === 'undefined') return {};
  const out: { ttp?: string; ttclid?: string } = {};
  try {
    const cookie = (document.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith('_ttp='));
    if (cookie) out.ttp = decodeURIComponent(cookie.slice(5));
  } catch {
    // ignore
  }
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('ttclid');
    const stored = sessionStorage.getItem(TTCLID_KEY);
    if (fromUrl || stored) out.ttclid = (fromUrl || stored) as string;
  } catch {
    // ignore
  }
  return out;
}

export function initTikTokPixel(pixelId: string): void {
  if (typeof window === 'undefined' || tiktokReady || !pixelId) return;
  try {
    /* eslint-disable */
    // Official TikTok base code (array-based queue), loads events.js asynchronously
    (function (w: any, d: Document, t: string) {
      w.TiktokAnalyticsObject = t;
      const ttq = (w[t] = w[t] || []);
      ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
      ttq.setAndDefer = function (obj: any, method: string) {
        obj[method] = function () {
          obj.push([method].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (id: string) {
        const e = ttq._i[id] || [];
        for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
        return e;
      };
      ttq.load = function (id: string, options?: any) {
        const src = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i = ttq._i || {};
        ttq._i[id] = [];
        ttq._i[id]._u = src;
        ttq._t = ttq._t || {};
        ttq._t[id] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[id] = options || {};
        const s = d.createElement('script');
        s.type = 'text/javascript';
        s.async = true;
        s.src = `${src}?sdkid=${id}&lib=${t}`;
        const first = d.getElementsByTagName('script')[0];
        first.parentNode!.insertBefore(s, first);
      };
      ttq.load(pixelId);
      ttq.page();
    })(window, document, 'ttq');
    /* eslint-enable */
    tiktokReady = true;
  } catch {
    // blocked / failed: stay inactive
  }
}

/**
 * Send a browser event with the SAME event_id as the server (Events API) copy.
 * Does nothing if the TikTok pixel isn't configured.
 */
export function trackTikTokEvent(
  event: 'ViewContent' | 'InitiateCheckout' | 'CompletePayment',
  data: { productId: string | number; productName: string; unitUsd: number; count: number; valueUsd: number },
  eventId: string
): void {
  if (typeof window === 'undefined' || !tiktokReady || !window.ttq) return;
  try {
    window.ttq.track(
      event,
      {
        contents: [
          {
            content_id: String(data.productId),
            content_name: data.productName,
            price: data.unitUsd,
            quantity: data.count,
          },
        ],
        content_type: 'product',
        value: data.valueUsd,
        currency: 'USD',
      },
      { event_id: eventId }
    );
  } catch {
    // ignore tracking errors
  }
}

/** Resolves once the tracking config has been read, so early events can wait for the pixel. */
export function isTikTokReady(): boolean {
  return tiktokReady;
}
