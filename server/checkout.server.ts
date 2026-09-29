/**
 * Server-Side Order Processing & Integrations Engine
 * Handles Duplicate Protection, Order ID Generation,
 * Google Sheets Webhook, Telegram Bot Notification, and Meta CAPI
 */

import crypto from 'crypto';
import { normalizeIraqiPhone } from '../src/lib/phone';
import { IRAQ_GOVERNORATES } from '../src/lib/governorates';
import { OrderPayload, OrderResult } from '../src/types';
import { sendMetaCapiPurchase } from './meta.server';
import { getProductDetails } from './rolemall.server';
import { getManualProduct, parseManualId, SheetTarget } from './supabase.server';

/**
 * Shared secret used to sign the internal call from /api/checkout to the
 * checkout-background function, so nobody can post fake orders to it directly.
 * Uses CHECKOUT_SECRET if set; otherwise derives one from server-only env vars
 * that are never exposed to the browser (the Google Sheet webhook / Telegram token).
 */
function getInternalSecret(): string {
  const explicit = (process.env.CHECKOUT_SECRET || '').trim();
  if (explicit) return explicit;
  const base = `${process.env.GOOGLE_SHEET_WEBHOOK_URL || ''}|${process.env.TELEGRAM_BOT_TOKEN || ''}`;
  if (base === '|') return '';
  return crypto.createHash('sha256').update(`tamam-internal:${base}`).digest('hex');
}

export function signInternalPayload(body: string): string {
  const secret = getInternalSecret();
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export function verifyInternalSignature(body: string, signature: string | undefined): boolean {
  const expected = signInternalPayload(body);
  if (!expected || !signature) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Accept the client's order ID only if it looks like one of ours; otherwise generate one.
 */
export function resolveOrderId(raw: unknown): string {
  if (typeof raw === 'string' && /^ORD-[A-Za-z0-9-]{4,40}$/.test(raw.trim())) {
    return raw.trim();
  }
  return generateOrderId();
}

/**
 * Never trust the price sent by the browser. Look the product up on the server.
 * - found: use the real price & title from Rolemall
 * - not_found: reject the order
 * - temporarily unavailable (supplier API down): accept the order with the
 *   browser price but flag it so it gets checked manually (don't lose the sale).
 */
export interface VerifiedProductResult {
  ok: boolean;
  error?: string;
  unitPrice?: number;
  productName?: string;
  priceVerified?: boolean;
  /** Which Google Sheet receives this order */
  sheetTarget?: SheetTarget;
  /** Value for the sheet's "معرف المنتج" column */
  sheetProductId?: string;
}

/** Webhook URL for each sheet. Manual products can be routed to a separate sheet. */
export function getSheetWebhookUrl(target: SheetTarget | undefined): string {
  if (target === 'other') {
    return (process.env.GOOGLE_SHEET_WEBHOOK_URL_MANUAL || '').trim();
  }
  return (process.env.GOOGLE_SHEET_WEBHOOK_URL || '').trim();
}

export function sheetLabel(target: SheetTarget | undefined): string {
  return target === 'other' ? 'الشيت الآخر (منتج يدوي)' : 'شيت رولمول';
}

export async function resolveVerifiedProduct(
  itemId: string,
  clientUnitPrice: number,
  clientProductName: string
): Promise<VerifiedProductResult> {
  if (!itemId) {
    return { ok: false, error: 'المنتج غير محدد، يرجى تحديث الصفحة والمحاولة مجدداً.' };
  }

  // Manual product from the dashboard: price, name and destination sheet come from Supabase
  const manualId = parseManualId(itemId);
  if (manualId !== null) {
    const { row, failed } = await getManualProduct(manualId);
    if (row && row.is_active) {
      return {
        ok: true,
        unitPrice: row.price,
        productName: row.title,
        priceVerified: true,
        sheetTarget: row.sheet_target,
        sheetProductId: row.product_code || itemId,
      };
    }
    if (!failed) {
      return { ok: false, error: 'عذراً، هذا المنتج غير متوفر حالياً.' };
    }
    // Database unreachable: keep the sale, flag it, and send to the manual sheet
    return {
      ok: true,
      unitPrice: Math.max(0, Number(clientUnitPrice) || 0),
      productName: clientProductName,
      priceVerified: false,
      sheetTarget: 'other',
      sheetProductId: itemId,
    };
  }

  let result: Awaited<ReturnType<typeof getProductDetails>>;
  try {
    result = await getProductDetails(itemId);
  } catch {
    result = { product: null, status: 'temporarily_unavailable' };
  }

  if (result.status === 'found' && result.product) {
    if (result.product.available === false) {
      return { ok: false, error: 'عذراً، هذا المنتج غير متوفر حالياً.' };
    }
    return {
      ok: true,
      unitPrice: result.product.price,
      productName: result.product.title,
      priceVerified: true,
      sheetTarget: 'rolemall',
      sheetProductId: itemId,
    };
  }

  if (result.status === 'not_found') {
    return { ok: false, error: 'عذراً، هذا المنتج غير متوفر حالياً.' };
  }

  return {
    ok: true,
    unitPrice: Math.max(0, Number(clientUnitPrice) || 0),
    productName: clientProductName,
    priceVerified: false,
    sheetTarget: 'rolemall',
    sheetProductId: itemId,
  };
}

export const UNVERIFIED_PRICE_NOTE = '⚠️ السعر لم يُتحقق منه من المورد وقت الطلب - راجعه قبل التأكيد';

// ---------------------------------------------------------------------------
// ⚠️ ملاحظة معمارية هامة بخصوص حماية الطلبات المكررة (In-Memory Duplicate Protection)
// - هذا السجل محلي بالكامل ومخزّن داخل ذاكرة الرام (In-Memory Map) لنسخة Node.js الحالية.
// - يُصفَّر بالكامل عند أي إعادة تشغيل للسيرفر (Redeploy، Crash، أو Server Restart).
// - غير موثوق بالكامل في حال تشغيل أكثر من نسخة سيرفر بالتوازي (Horizontal Scaling / Multi-instance):
//   إذا قام العميل بالنقر مرتين وقام الـ Load Balancer بتوزيع الطلبين على نسختين مختلفتين من السيرفر،
//   قد يمر الطلبان معاً كطلبين منفصلين لأن كل نسخة تملك ذاكرتها المستقلة.
// - لحماية متقدمة ومطلقة عبر خوادم متعددة مستقبلاً، يجب استخدام قفل موزع (Distributed Lock) عبر Redis مع فترات TTL.
// ---------------------------------------------------------------------------
// In-memory duplicate protection: Map<"phone_itemId", timestamp>
export const recentOrders = new Map<string, number>();
export const DUPLICATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function generateOrderId(): string {
  const timestamp = Date.now().toString().slice(-8);
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${timestamp}-${randomHex}`;
}

async function wait(ms: number): Promise<void> {
  if (ms <= 0) return;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send order data to Google Sheets with 4 retries (0ms, 150ms, 300ms, 600ms)
 */
export async function sendToGoogleSheetsWithRetry(
  orderData: Record<string, any>,
  retryDelays: number[] = [0, 150, 300, 600],
  sheetTarget: SheetTarget = 'rolemall'
): Promise<boolean> {
  const webhookUrl = getSheetWebhookUrl(sheetTarget);
  if (!webhookUrl) {
    // The main sheet is optional, but a manual product routed to a missing sheet must raise an alert
    if (sheetTarget === 'other') {
      console.error('GOOGLE_SHEET_WEBHOOK_URL_MANUAL is not set; manual-product order not recorded in a sheet.');
      return false;
    }
    return true;
  }


  for (let attempt = 0; attempt < retryDelays.length; attempt++) {
    try {
      await wait(retryDelays[attempt]);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(webhookUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      clearTimeout(timeout);

      if (res.ok) {
        // Apps Script always answers 200; if it reports { ok: false } treat it as a failure
        const text = await res.text().catch(() => '');
        try {
          const parsed = JSON.parse(text);
          if (parsed && parsed.ok === false) {
            console.error('Google Sheet script reported an error:', parsed.error);
            continue;
          }
        } catch {
          // Not JSON (older scripts): a 200 means success
        }
        return true;
      }
    } catch {
      // Continue to next retry attempt
    }
  }

  console.error('Google Sheets notification failed after retries.');
  return false;
}

/**
 * Send Telegram notification with 4 retries (0ms, 150ms, 300ms, 600ms)
 */
export async function sendToTelegramWithRetry(
  message: string,
  retryDelays: number[] = [0, 150, 300, 600]
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return true;


  for (let attempt = 0; attempt < retryDelays.length; attempt++) {
    try {
      await wait(retryDelays[attempt]);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          // Plain text on purpose: customer-typed "_" or "*" would break Markdown and make Telegram reject the message
          text: message,
        }),
      });
      clearTimeout(timeout);

      if (res.ok) return true;
    } catch {
      // Continue to next retry attempt
    }
  }

  console.error('Telegram notification failed after retries.');
  return false;
}

/**
 * Send Emergency Failure Alert to Telegram if primary order recording fails
 */
export async function sendFailureAlert(params: {
  orderId: string;
  name: string;
  phone: string;
  governorate: string;
  address: string;
  itemId: string | number;
  reason: string;
}): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const alertMessage = `🚨 تنبيه: فشل تسجيل طلب تلقائياً

رقم الطلب: ${params.orderId}
الاسم: ${params.name}
الهاتف: ${params.phone}
المحافظة: ${params.governorate}
العنوان: ${params.address}
المنتج: #${params.itemId}
السبب: ${params.reason}

⚠️ يرجى المتابعة اليدوية مع الزبون فوراً.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: alertMessage,
      }),
    });
    clearTimeout(timeout);
  } catch (err) {
    console.error('Failed to send emergency failure alert to Telegram:', err);
  }
}

export async function processOrder(
  payload: OrderPayload,
  clientMeta: { clientIp?: string; userAgent?: string } = {}
): Promise<OrderResult> {
  // 1. Server-side validation
  const name = String(payload.cus_name || '').trim();
  if (name.length < 2) {
    return { success: false, error: 'يرجى إدخال الاسم الكامل (حرفين على الأقل)' };
  }

  const phoneCheck = normalizeIraqiPhone(payload.cus_num1 || '');
  if (!phoneCheck.isValid) {
    return { success: false, error: phoneCheck.error || 'رقم الهاتف غير صحيح' };
  }

  const normalizedPhone = phoneCheck.normalized;
  const governorate = String(payload.capetel || '').trim();
  if (!IRAQ_GOVERNORATES.includes(governorate as any)) {
    return { success: false, error: 'يرجى اختيار المحافظة من القائمة المعتمدة' };
  }

  const address = String(payload.address || '').trim();
  if (address.length < 3) {
    return { success: false, error: 'يرجى كتابة العنوان التفصيلي (المنطقة / أقرب نقطة دالة)' };
  }

  const count = Math.max(1, Math.min(50, Math.floor(Number(payload.count || 1)) || 1));
  const itemId = String(payload.item_id || '').trim();

  const verified = await resolveVerifiedProduct(
    itemId,
    Number(payload.unit_price || 0),
    String(payload.product_name || 'منتج تمام شوب').trim()
  );
  if (!verified.ok) {
    return { success: false, error: verified.error };
  }
  const unitPrice = verified.unitPrice;
  const expectedTotal = unitPrice * count;
  const productName = verified.productName;
  const rawNotes = String(payload.note || '').trim();
  // Price comes from the supplier, or the last saved price if the supplier is down; no warning note
    const notes = rawNotes;

  // 2. Duplicate Check within 5 minutes
  const duplicateKey = `${normalizedPhone}_${itemId}`;
  const now = Date.now();
  const lastOrderedTime = recentOrders.get(duplicateKey);

  if (lastOrderedTime && (now - lastOrderedTime < DUPLICATE_WINDOW_MS)) {
    return {
      success: false,
      duplicate: true,
      error: 'تم استلام طلبك لهذا المنتج مسبقاً بنجاح! فريقنا يجهّز طلبك حالياً وسنتصل بك للتأكيد.',
    };
  }

  // Record order key for duplicate protection
  recentOrders.set(duplicateKey, now);

  // Clean old entries
  for (const [key, timestamp] of recentOrders.entries()) {
    if (now - timestamp > DUPLICATE_WINDOW_MS) {
      recentOrders.delete(key);
    }
  }

  // 3. Use client-provided orderId or generate official Order ID
  const orderId = resolveOrderId(payload.orderId);

  // 4. Baghdad Time Formatted
  const baghdadTime = new Intl.DateTimeFormat('ar-IQ', {
    timeZone: 'Asia/Baghdad',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(new Date());

  // 5. Non-blocking Background Integrations for Render/Express
  (async () => {
    // Google Sheets payload
    const sheetData = {
      orderId,
      productName,
      name,
      phone: normalizedPhone,
      governorate,
      address,
      productId: verified.sheetProductId || itemId,
      quantity: count,
      totalPrice: expectedTotal,
      notes: notes || 'بدون ملاحظات',
      createdAt: baghdadTime,
    };

    // Telegram formatted message (simplified, order-facing layout)
    const telegramMsg = `📦 المنتج: ${productName}${verified.sheetTarget === 'other' ? `\n\n🗂️ الشيت: ${sheetLabel(verified.sheetTarget)}` : ''}

الاسم: ${name}

الهاتف: ${normalizedPhone}

المحافظة: ${governorate}

العنوان: ${address}

العدد: ${count}

المبلغ الإجمالي: ${expectedTotal.toLocaleString('en-US')} د.ع`;

    const productPageUrl = `${(process.env.APP_URL || 'https://tamam-iq.com').replace(/\/+$/, '')}/product/${itemId}`;

    const [sheetsSuccess, telegramSuccess] = await Promise.all([
      sendToGoogleSheetsWithRetry(sheetData, undefined, verified.sheetTarget),
      sendToTelegramWithRetry(telegramMsg),
      sendMetaCapiPurchase({
        eventName: 'Purchase',
        eventId: orderId,
        orderId,
        productName,
        productId: itemId,
        totalPriceIqd: expectedTotal,
        count,
        customerName: name,
        phone: normalizedPhone,
        governorate,
        clientIp: clientMeta.clientIp,
        userAgent: clientMeta.userAgent,
        fbc: payload.fbc,
        fbp: payload.fbp,
        sourceUrl: productPageUrl,
      }).catch(() => false),
    ]);

    if (!sheetsSuccess || !telegramSuccess) {
      await sendFailureAlert({
        orderId,
        name,
        phone: normalizedPhone,
        governorate,
        address,
        itemId,
        reason: `فشل الإرسال إلى (${!sheetsSuccess ? 'Google Sheets ' : ''}${!telegramSuccess ? 'Telegram' : ''}) بعد 4 محاولات`,
      });
    }
  })();

  return {
    success: true,
    orderId,
    message: 'تم استلام طلبك بنجاح وسنتواصل معك لتأكيد التوصيل',
  };
}
