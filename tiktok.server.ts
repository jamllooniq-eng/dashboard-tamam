/**
 * TikTok Events API (server-side) — prepared for the future, inactive by default.
 *
 * Nothing is sent unless BOTH environment variables are set in Netlify:
 *   TIKTOK_PIXEL_ID       (public pixel code, also used by the browser pixel)
 *   TIKTOK_ACCESS_TOKEN   (secret — server-side only, never exposed to the browser)
 * Optional:
 *   TIKTOK_TEST_EVENT_CODE  (routes events to TikTok "Test Events" while testing)
 *
 * Deduplication: every event carries the same event_id as the browser pixel
 * (ttq.track(..., { event_id })), so TikTok counts each action once.
 */

import { sha256 } from './meta.server';
import { normalizeDigits } from '../src/lib/phone';

const TIKTOK_ENDPOINT = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

export type TikTokEventName = 'ViewContent' | 'InitiateCheckout' | 'CompletePayment';

export interface TikTokServerEvent {
  event: TikTokEventName;
  eventId: string;
  productId: string | number;
  productName: string;
  priceIqd: number; // unit price
  count: number;
  totalPriceIqd?: number; // for CompletePayment
  clientIp?: string;
  userAgent?: string;
  ttp?: string; // _ttp cookie
  ttclid?: string; // TikTok click id from the ad URL
  phone?: string; // raw Iraqi phone, hashed here
  sourceUrl?: string;
}

export function isTikTokConfigured(): boolean {
  return Boolean((process.env.TIKTOK_PIXEL_ID || '').trim() && (process.env.TIKTOK_ACCESS_TOKEN || '').trim());
}

/** Iraqi phone -> E.164 (+9647XXXXXXXXX) then SHA-256, as TikTok expects. */
function hashPhoneForTikTok(rawPhone?: string): string | undefined {
  if (!rawPhone) return undefined;
  let digits = normalizeDigits(rawPhone);
  if (digits.startsWith('00964')) digits = digits.slice(2);
  else if (digits.startsWith('07')) digits = '964' + digits.slice(1);
  else if (digits.startsWith('7') && digits.length === 10) digits = '964' + digits;
  if (!/^9647\d{9}$/.test(digits)) return undefined;
  return sha256(`+${digits}`);
}

export async function sendTikTokEvent(params: TikTokServerEvent): Promise<boolean> {
  if (!isTikTokConfigured()) return false;

  const pixelId = (process.env.TIKTOK_PIXEL_ID || '').trim();
  const accessToken = (process.env.TIKTOK_ACCESS_TOKEN || '').trim();
  const testEventCode = (process.env.TIKTOK_TEST_EVENT_CODE || '').trim();
  const rate = Number(process.env.IQD_TO_USD_RATE || 1400) || 1400;

  const count = Math.max(1, Number(params.count) || 1);
  const unitUsd = Number(((Number(params.priceIqd) || 0) / rate).toFixed(2));
  const totalIqd = params.totalPriceIqd !== undefined ? Number(params.totalPriceIqd) || 0 : (Number(params.priceIqd) || 0) * count;
  const valueUsd = Number((totalIqd / rate).toFixed(2));

  const user: Record<string, string> = {};
  if (params.ttp) user.ttp = params.ttp;
  if (params.ttclid) user.ttclid = params.ttclid;
  if (params.clientIp) user.ip = params.clientIp;
  if (params.userAgent) user.user_agent = params.userAgent;
  const hashedPhone = hashPhoneForTikTok(params.phone);
  if (hashedPhone) user.phone = hashedPhone;

  const body: Record<string, unknown> = {
    event_source: 'web',
    event_source_id: pixelId,
    data: [
      {
        event: params.event,
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.eventId,
        user,
        page: params.sourceUrl ? { url: params.sourceUrl } : undefined,
        properties: {
          currency: 'USD',
          value: valueUsd,
          content_type: 'product',
          contents: [
            {
              content_id: String(params.productId),
              content_name: params.productName,
              price: unitUsd,
              quantity: count,
            },
          ],
        },
      },
    ],
  };
  if (testEventCode) body.test_event_code = testEventCode;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(TIKTOK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': accessToken },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    // TikTok answers HTTP 200 with a non-zero "code" on errors
    if (!res.ok || (json && typeof json.code === 'number' && json.code !== 0)) {
      console.warn(`[TikTok] ${params.event} not accepted:`, json?.message || res.status);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`[TikTok] ${params.event} failed:`, err?.message || err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
