import type { Handler } from '@netlify/functions';
import { sendMetaCapiEvent } from '../../server/meta.server';
import { sendTikTokEvent } from '../../server/tiktok.server';

// This public endpoint only relays early-funnel events. Purchase is sent exclusively by the
// signed checkout flow, so it can never be faked through here.
const ALLOWED_EVENTS = new Set(['ViewContent', 'InitiateCheckout']);
const EVENT_ID_PATTERN = /^[A-Za-z0-9_.:-]{8,120}$/;

/**
 * Lightweight CAPI endpoint for early-funnel events (ViewContent, InitiateCheckout)
 * that don't yet have full customer identity data (name/phone), unlike Purchase.
 * Called directly from the browser alongside the normal fbq() pixel call, to give
 * these events server-side CAPI coverage that survives ad-blockers.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { eventName, productId, productName, priceIqd, count, sourceUrl, fbc, fbp, ttp, ttclid } = body;

    if (!eventName || !productId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }
    if (!ALLOWED_EVENTS.has(eventName)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Event not allowed' }) };
    }
    // Must be the same ID the browser pixel used; a malformed one is replaced (no dedup, but no garbage)
    const eventId =
      typeof body.eventId === 'string' && EVENT_ID_PATTERN.test(body.eventId)
        ? body.eventId
        : `${eventName}_${String(productId).replace(/[^A-Za-z0-9-]/g, '')}_${Date.now()}_srv`;

    const clientIp =
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['client-ip'] ||
      (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const userAgent = event.headers['user-agent'];

    const [ok] = await Promise.all([
      sendMetaCapiEvent({
        eventName,
        eventId,
        productId,
        productName: productName || `منتج #${productId}`,
        priceIqd: Number(priceIqd) || 0,
        count: Number(count) || 1,
        clientIp,
        userAgent,
        fbc,
        fbp,
        sourceUrl,
      }),
      // No-op unless TIKTOK_PIXEL_ID and TIKTOK_ACCESS_TOKEN are set
      sendTikTokEvent({
        event: eventName,
        eventId,
        productId,
        productName: productName || `منتج #${productId}`,
        priceIqd: Number(priceIqd) || 0,
        count: Number(count) || 1,
        clientIp,
        userAgent,
        ttp: typeof ttp === 'string' ? ttp : undefined,
        ttclid: typeof ttclid === 'string' ? ttclid : undefined,
        sourceUrl,
      }).catch(() => false),
    ]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: ok }),
    };
  } catch (err: any) {
    console.warn('Notice: /track event dispatch issue:', err?.message || err);
    // Never fail loudly to the client for a tracking-only endpoint
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false }),
    };
  }
};
