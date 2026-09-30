import type { Handler } from '@netlify/functions';
import { normalizeIraqiPhone } from '../../src/lib/phone';
import { IRAQ_GOVERNORATES } from '../../src/lib/governorates';
import {
  recentOrders,
  DUPLICATE_WINDOW_MS,
  resolveOrderId,
  resolveVerifiedProduct,
  signInternalPayload,
  sendToGoogleSheetsWithRetry,
  sendToTelegramWithRetry,
  sheetLabel,
} from '../../server/checkout.server';
import { sendMetaCapiPurchase } from '../../server/meta.server';
import { sendTikTokEvent } from '../../server/tiktok.server';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    let body: any = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }

    // 1. Server-side validation
    const name = String(body.cus_name || '').trim();
    if (name.length < 2) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'يرجى إدخال الاسم الكامل (حرفين على الأقل)' }),
      };
    }

    const phoneCheck = normalizeIraqiPhone(body.cus_num1 || '');
    if (!phoneCheck.isValid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: phoneCheck.error || 'رقم الهاتف غير صحيح' }),
      };
    }

    const normalizedPhone = phoneCheck.normalized;
    const governorate = String(body.capetel || '').trim();
    if (!IRAQ_GOVERNORATES.includes(governorate as any)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'يرجى اختيار المحافظة من القائمة المعتمدة' }),
      };
    }

    const address = String(body.address || '').trim();
    if (address.length < 3) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'يرجى كتابة العنوان التفصيلي (المنطقة / أقرب نقطة دالة)' }),
      };
    }

    const count = Math.max(1, Math.min(50, Math.floor(Number(body.count || 1)) || 1));
    const itemId = String(body.item_id || '').trim();

    // Price & title come from the supplier on the server, never from the browser
    const verified = await resolveVerifiedProduct(
      itemId,
      Number(body.unit_price || 0),
      String(body.product_name || 'منتج تمام شوب').trim()
    );
    if (!verified.ok) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: verified.error }),
      };
    }
    const unitPrice = verified.unitPrice;
    const expectedTotal = unitPrice * count;
    const productName = verified.productName;
    const rawNotes = String(body.note || '').trim();
    // Price comes from the supplier, or the last saved price if the supplier is down; no warning note
    const notes = rawNotes;

    // 2. Duplicate Check within 5 minutes (Synchronous & Fast)
    const duplicateKey = `${normalizedPhone}_${itemId}`;
    const now = Date.now();
    const lastOrderedTime = recentOrders.get(duplicateKey);

    if (lastOrderedTime && now - lastOrderedTime < DUPLICATE_WINDOW_MS) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          duplicate: true,
          error: 'تم استلام طلبك لهذا المنتج مسبقاً بنجاح! فريقنا يجهّز طلبك حالياً وسنتصل بك للتأكيد.',
        }),
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

    // 3. Official Order ID (from client or generated fallback)
    const orderId = resolveOrderId(body.orderId);

    // 4. Baghdad Time Formatted
    const baghdadTime = new Intl.DateTimeFormat('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(new Date());

    const clientIp = (event.headers['x-forwarded-for'] || event.headers['client-ip'] || '').split(',')[0].trim();
    const userAgent = event.headers['user-agent'];

    // 5. Fire Background Function without blocking client response
    const host = event.headers['host'] || event.headers['Host'] || 'localhost';
    const proto = event.headers['x-forwarded-proto'] || 'https';
    const siteUrl = process.env.URL || process.env.DEPLOY_URL || `${proto}://${host}`;
    const backgroundUrl = `${siteUrl.replace(/\/+$/, '')}/.netlify/functions/checkout-background`;

    const backgroundPayload = {
      orderId,
      name,
      phone: normalizedPhone,
      governorate,
      address,
      itemId,
      productName,
      quantity: count,
      totalPrice: expectedTotal,
      notes,
      priceVerified: verified.priceVerified,
      sheetTarget: verified.sheetTarget,
      sheetProductId: verified.sheetProductId || itemId,
      baghdadTime,
      fbc: body.fbc,
      fbp: body.fbp,
      ttp: typeof body.ttp === 'string' ? body.ttp : undefined,
      ttclid: typeof body.ttclid === 'string' ? body.ttclid : undefined,
      externalId: typeof body.externalId === 'string' ? body.externalId : undefined,
      clientIp,
      userAgent,
    };

    try {
      const serialized = JSON.stringify(backgroundPayload);
      const bgRes = await fetch(backgroundUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tamam-signature': signInternalPayload(serialized),
        },
        body: serialized,
      });
      // Background functions answer 202 once queued; anything else means it never started
      if (!bgRes.ok) {
        throw new Error(`Background function responded ${bgRes.status}`);
      }
    } catch (err) {
      console.error('CRITICAL: Failed to trigger background checkout function entirely:', err);
      // Fallback: the background function couldn't be reached (e.g. site protection, network),
      // so record the order right here instead of losing it. The customer waits a moment longer.
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
      const telegramMsg = `📦 المنتج: ${productName}${verified.sheetTarget === 'other' ? `\n\n🗂️ الشيت: ${sheetLabel(verified.sheetTarget)}` : ''}

الاسم: ${name}

الهاتف: ${normalizedPhone}

المحافظة: ${governorate}

العنوان: ${address}

العدد: ${count}

المبلغ الإجمالي: ${expectedTotal.toLocaleString('en-US')} د.ع`;

      const productPageUrl = `${(process.env.APP_URL || siteUrl).replace(/\/+$/, '')}/product/${itemId}`;
      const [sheetsOk, telegramOk] = await Promise.all([
        sendToGoogleSheetsWithRetry(sheetData, [0, 500], verified.sheetTarget),
        sendToTelegramWithRetry(telegramMsg, [0, 500]),
        // Keep Meta server-side Purchase tracking even on this fallback path (same event_id as the Pixel)
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
          clientIp,
          userAgent,
          fbc: body.fbc,
          fbp: body.fbp,
          sourceUrl: productPageUrl,
          externalId: typeof body.externalId === 'string' ? body.externalId : undefined,
        }).catch(() => false),
        // No-op unless TikTok is configured
        sendTikTokEvent({
          event: 'CompletePayment',
          eventId: orderId,
          productId: itemId,
          productName,
          priceIqd: unitPrice,
          count,
          totalPriceIqd: expectedTotal,
          clientIp,
          userAgent,
          ttp: typeof body.ttp === 'string' ? body.ttp : undefined,
          ttclid: typeof body.ttclid === 'string' ? body.ttclid : undefined,
          phone: normalizedPhone,
          sourceUrl: productPageUrl,
        }).catch(() => false),
      ]);

      if (!sheetsOk) {
        try {
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          const chatId = process.env.TELEGRAM_CHAT_ID;
          if (botToken && chatId) {
            const emergencyMsg = `🚨🚨 طلب لم يُسجَّل بالشيت\n\nرقم الطلب: ${orderId}\nالاسم: ${name}\nالهاتف: ${normalizedPhone}\nالمحافظة: ${governorate}\nالعنوان: ${address}\nالمنتج: #${itemId}\n\n⚠️ تواصل مع الزبون يدوياً فوراً.`;
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: emergencyMsg }),
            });
          }
        } catch (alertErr) {
          console.error('Even the last-resort emergency alert failed:', alertErr);
        }
      } else if (!telegramOk) {
        console.error(`Order ${orderId} recorded in sheet via fallback, but Telegram failed.`);
      }
    }

    // 6. Return instant confirmation to client
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        orderId,
        message: 'تم استلام طلبك بنجاح وسنتواصل معك لتأكيد التوصيل',
      }),
    };
  } catch (err: any) {
    console.error('Error in Netlify function /api/checkout:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'حدث خطأ أثناء معالجة الطلب، يرجى المحاولة لاحقاً.',
      }),
    };
  }
};
