import type { Handler } from '@netlify/functions';
import { sendMetaCapiEvent } from '../../server/meta.server';

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
    const { eventName, eventId, productId, productName, priceIqd, count, sourceUrl, fbc, fbp } = body;

    if (!eventName || !productId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const clientIp =
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['client-ip'] ||
      (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const userAgent = event.headers['user-agent'];

    const ok = await sendMetaCapiEvent({
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
    });

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
