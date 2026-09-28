/**
 * Server-Side Meta Conversions API (CAPI)
 * Handles hashed customer matching (fn, ph, st, country, fbp, fbc, ip, ua)
 * and server-to-server purchase conversion tracking with deduplication
 */

import crypto from 'crypto';
import { normalizeDigits } from '../src/lib/phone';

// Graph API version (override via META_GRAPH_VERSION env var if Meta deprecates this one)
const META_GRAPH_VERSION = (process.env.META_GRAPH_VERSION || 'v23.0').trim();

interface SendCapiEventParams {
  eventName?: string;
  eventId?: string;
  orderId: string;
  productName: string;
  productId: string | number;
  totalPriceIqd: number;
  count: number;
  customerName: string;
  phone: string;
  governorate: string;
  clientIp?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
  sourceUrl?: string;
}

/**
 * Compute lowercase hexadecimal SHA-256 hash
 */
export function sha256(val: string): string {
  if (!val) return '';
  return crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex');
}

/**
 * Normalize customer name for Meta matching
 * Trims, removes special symbols/punctuation and extra whitespace
 */
export function normalizeNameForMeta(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic diacritics / tashkeel
    .replace(/[^\p{L}\s]/gu, '') // keep letters and whitespace only
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Normalize Iraqi phone number to standard E.164 without plus for Meta (9647XXXXXXXXX)
 */
export function normalizePhoneForMeta(rawPhone: string): string {
  if (!rawPhone) return '';
  let digits = normalizeDigits(rawPhone).replace(/\D/g, '');

  if (digits.startsWith('009647')) {
    digits = '9647' + digits.substring(6);
  } else if (digits.startsWith('9647')) {
    // Already in 9647XXXXXXXXX format
  } else if (digits.startsWith('07')) {
    digits = '964' + digits.substring(1);
  } else if (digits.startsWith('7') && digits.length === 10) {
    digits = '964' + digits;
  }

  return digits;
}

/**
 * Normalize Iraqi governorate / state for Meta matching (st)
 */
export function normalizeStateForMeta(rawGov: string): string {
  if (!rawGov) return '';
  return rawGov
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // remove Arabic diacritics and tatweel
    .replace(/[أإآ]/g, 'ا') // normalize alef variants
    .replace(/[^\p{L}\s]/gu, '') // keep letters and whitespace only
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export async function sendMetaCapiPurchase(params: SendCapiEventParams): Promise<boolean> {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    // Graceful silent return if not configured
    return true;
  }

  try {
    const rate = Number(process.env.IQD_TO_USD_RATE || 1400);
    const usdValue = Number((params.totalPriceIqd / rate).toFixed(2));

    // Normalize customer matching fields
    const metaPhone = normalizePhoneForMeta(params.phone);
    const metaName = normalizeNameForMeta(params.customerName);
    const metaState = normalizeStateForMeta(params.governorate);

    // Clean client IP (strip IPv4-mapped IPv6 prefix if present)
    let cleanIp = params.clientIp?.trim();
    if (cleanIp) {
      if (cleanIp.startsWith('::ffff:')) {
        cleanIp = cleanIp.substring(7);
      }
      cleanIp = cleanIp.split(',')[0].trim();
    }

    // Exact eventId matching Browser Pixel (ORD-XXXX)
    const eventId = params.eventId || params.orderId;

    const rawUserData: Record<string, any> = {
      ph: metaPhone ? [sha256(metaPhone)] : undefined,
      fn: metaName ? [sha256(metaName)] : undefined,
      st: metaState ? [sha256(metaState)] : undefined,
      country: [sha256('iq')],
      client_ip_address: cleanIp || undefined,
      client_user_agent: params.userAgent?.trim() || undefined,
      fbc: (params.fbc && typeof params.fbc === 'string' && params.fbc.trim().startsWith('fb.'))
        ? params.fbc.trim()
        : undefined,
      fbp: (params.fbp && typeof params.fbp === 'string' && params.fbp.trim().startsWith('fb.'))
        ? params.fbp.trim()
        : undefined,
    };

    // Filter out undefined, null, or empty values to ensure clean payload
    const userData: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawUserData)) {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          const filteredArr = value.filter(v => typeof v === 'string' && v.length > 0);
          if (filteredArr.length > 0) {
            userData[key] = filteredArr;
          }
        } else {
          userData[key] = value;
        }
      }
    }

    const customData = {
      content_ids: [String(params.productId)],
      content_name: params.productName,
      content_type: 'product',
      value: usdValue,
      currency: 'USD',
      num_items: params.count,
      order_id: params.orderId,
    };

    const payload: Record<string, any> = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: 'website',
          event_source_url: params.sourceUrl || process.env.APP_URL || 'https://tamam-iq.com',
          user_data: userData,
          custom_data: customData,
        },
      ],
      access_token: accessToken,
    };

    const testEventCode = process.env.META_TEST_EVENT_CODE?.trim();
    if (testEventCode) {
      payload.test_event_code = testEventCode;
    }

    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Meta CAPI response error:', errText);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Meta CAPI error:', err);
    return false;
  }
}

interface SendCapiEarlyEventParams {
  eventName: 'ViewContent' | 'InitiateCheckout' | string;
  eventId?: string;
  productId: string | number;
  productName: string;
  priceIqd: number;
  count: number;
  clientIp?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
  sourceUrl?: string;
}

/**
 * Generic server-side CAPI dispatcher for early-funnel events (ViewContent, InitiateCheckout)
 * where full customer identity (name/phone/governorate) is not yet available — unlike
 * Purchase, which has full Advanced Matching via sendMetaCapiPurchase above.
 * This gives these events resilience against browser-side ad-blockers, since the
 * server-to-server call cannot be blocked the way a client-side fbq() pixel call can.
 */
export async function sendMetaCapiEvent(params: SendCapiEarlyEventParams): Promise<boolean> {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    return true;
  }

  try {
    const rate = Number(process.env.IQD_TO_USD_RATE || 1400);
    const usdValue = Number((params.priceIqd / rate).toFixed(2));

    let cleanIp = params.clientIp?.trim();
    if (cleanIp) {
      if (cleanIp.startsWith('::ffff:')) {
        cleanIp = cleanIp.substring(7);
      }
      cleanIp = cleanIp.split(',')[0].trim();
    }

    const rawUserData: Record<string, any> = {
      country: [sha256('iq')],
      client_ip_address: cleanIp || undefined,
      client_user_agent: params.userAgent?.trim() || undefined,
      fbc: (params.fbc && typeof params.fbc === 'string' && params.fbc.trim().startsWith('fb.'))
        ? params.fbc.trim()
        : undefined,
      fbp: (params.fbp && typeof params.fbp === 'string' && params.fbp.trim().startsWith('fb.'))
        ? params.fbp.trim()
        : undefined,
    };

    const userData: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawUserData)) {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          const filteredArr = value.filter(v => typeof v === 'string' && v.length > 0);
          if (filteredArr.length > 0) {
            userData[key] = filteredArr;
          }
        } else {
          userData[key] = value;
        }
      }
    }

    const customData = {
      content_ids: [String(params.productId)],
      content_name: params.productName,
      content_type: 'product',
      value: usdValue,
      currency: 'USD',
      num_items: params.count,
    };

    const payload: Record<string, any> = {
      data: [
        {
          event_name: params.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: params.eventId,
          action_source: 'website',
          event_source_url: params.sourceUrl || process.env.APP_URL || 'https://tamam-iq.com',
          user_data: userData,
          custom_data: customData,
        },
      ],
      access_token: accessToken,
    };

    const testEventCode = process.env.META_TEST_EVENT_CODE?.trim();
    if (testEventCode) {
      payload.test_event_code = testEventCode;
    }

    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Meta CAPI (${params.eventName}) response error:`, errText);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`Meta CAPI (${params.eventName}) error:`, err);
    return false;
  }
}
