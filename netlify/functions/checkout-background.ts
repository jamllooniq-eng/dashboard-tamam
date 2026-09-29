import type { Handler } from '@netlify/functions';
import {
  sendToGoogleSheetsWithRetry,
  sendToTelegramWithRetry,
  sendFailureAlert,
  verifyInternalSignature,
  sheetLabel,
} from '../../server/checkout.server';

// Background functions may run up to 15 minutes, so the Google Sheet (main order record)
// gets a patient retry schedule instead of Netlify re-running the whole function
// (which used to duplicate the Telegram message and the Meta Purchase event).
const SHEETS_RETRY_DELAYS_MS = [0, 1000, 3000, 8000, 20000, 45000];
import { sendMetaCapiPurchase } from '../../server/meta.server';
import { sendTikTokEvent } from '../../server/tiktok.server';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // Only accept calls signed by our own /api/checkout function
  const signature = event.headers['x-tamam-signature'] || event.headers['X-Tamam-Signature'];
  if (!verifyInternalSignature(event.body || '', signature)) {
    console.warn('Rejected unsigned call to checkout-background');
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    let payload: any = {};
    if (event.body) {
      payload = JSON.parse(event.body);
    }

    const {
      orderId,
      name,
      phone,
      governorate,
      address,
      itemId,
      productName,
      quantity,
      totalPrice,
      notes,
      baghdadTime,
      fbc,
      fbp,
      clientIp,
      userAgent,
      priceVerified,
    } = payload;
    const sheetTarget = payload.sheetTarget === 'other' ? 'other' : 'rolemall';

    if (!orderId || !name || !phone) {
      console.error('Missing critical order fields in checkout-background:', payload);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required order fields' }),
      };
    }

    const formattedTime =
      baghdadTime ||
      new Intl.DateTimeFormat('ar-IQ', {
        timeZone: 'Asia/Baghdad',
        dateStyle: 'full',
        timeStyle: 'medium',
      }).format(new Date());

    // 1. Prepare Google Sheets Data
    const sheetData = {
      orderId,
      productName: productName || 'منتج تمام شوب',
      name,
      phone,
      governorate,
      address,
      productId: payload.sheetProductId || itemId,
      quantity: quantity || 1,
      totalPrice: totalPrice || 0,
      notes: notes || 'بدون ملاحظات',
      createdAt: formattedTime,
    };

    // 2. Prepare Telegram Message (simplified, order-facing layout)
    const telegramMsg = `📦 المنتج: ${productName || 'منتج تمام شوب'}${sheetTarget === 'other' ? `\n\n🗂️ الشيت: ${sheetLabel(sheetTarget)}` : ''}

الاسم: ${name}

الهاتف: ${phone}

المحافظة: ${governorate}

العنوان: ${address}

العدد: ${quantity || 1}

المبلغ الإجمالي: ${Number(totalPrice || 0).toLocaleString('en-US')} د.ع`;

    const productPageUrl = `${(process.env.APP_URL || 'https://tamam-iq.com').replace(/\/+$/, '')}/product/${itemId}`;

    // 3. Execute all external delivery destinations in parallel
    const [sheetsSuccess, telegramSuccess, capiSuccess] = await Promise.all([
      sendToGoogleSheetsWithRetry(sheetData, SHEETS_RETRY_DELAYS_MS, sheetTarget),
      sendToTelegramWithRetry(telegramMsg),
      sendMetaCapiPurchase({
        eventName: 'Purchase',
        eventId: orderId,
        orderId,
        productName: productName || 'منتج تمام شوب',
        productId: itemId,
        totalPriceIqd: totalPrice || 0,
        count: quantity || 1,
        customerName: name,
        phone,
        governorate,
        clientIp,
        userAgent,
        fbc,
        fbp,
        sourceUrl: productPageUrl,
      }).catch(() => false),
      // No-op unless TikTok is configured; same orderId as the browser pixel event_id
      sendTikTokEvent({
        event: 'CompletePayment',
        eventId: orderId,
        productId: itemId,
        productName: productName || 'منتج تمام شوب',
        priceIqd: (totalPrice || 0) / Math.max(1, quantity || 1),
        count: quantity || 1,
        totalPriceIqd: totalPrice || 0,
        clientIp,
        userAgent,
        ttp: typeof payload.ttp === 'string' ? payload.ttp : undefined,
        ttclid: typeof payload.ttclid === 'string' ? payload.ttclid : undefined,
        phone,
        sourceUrl: productPageUrl,
      }).catch(() => false),
    ]);

    // 4. Check for destination failures
    const failedServices: string[] = [];
    if (!sheetsSuccess) failedServices.push(sheetTarget === 'other' ? 'Google Sheets (الشيت الآخر)' : 'Google Sheets');
    if (!telegramSuccess) failedServices.push('Telegram Bot');
    if (!capiSuccess) failedServices.push('Meta CAPI');

    if (failedServices.length > 0) {
      console.error(`Order ${orderId} encountered failures for: ${failedServices.join(', ')}`);

      // If either Google Sheets or Telegram failed after all retries, send emergency alert
      if (!sheetsSuccess || !telegramSuccess) {
        await sendFailureAlert({
          orderId,
          name,
          phone,
          governorate,
          address,
          itemId,
          reason: `فشل الإرسال إلى (${failedServices.join(' + ')}) بعد عدة محاولات`,
        });
      }
      // No throw here on purpose: a Netlify re-run would resend Telegram + Meta Purchase
      // as duplicates. The emergency Telegram alert above already carries the full order.
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, orderId }),
    };
  } catch (error: any) {
    console.error('Error in checkout-background execution:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Background processing failed' }) };
  }
};
