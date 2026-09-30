import type { Handler } from '@netlify/functions';
import crypto from 'crypto';
import {
import { syncFullCatalog } from '../../server/rolemall.server';
  isSupabaseConfigured,
  adminListManualProducts,
  adminCreateManualProduct,
  adminUpdateManualProduct,
  adminDeleteManualProduct,
  uploadProductImage,
  ManualProductInput,
  MANUAL_ID_PREFIX,
} from '../../server/supabase.server';

/**
 * Admin API for the /admin dashboard (manual products).
 * Auth: a single password set in Netlify env var ADMIN_PASSWORD.
 * Login returns a signed token valid for 7 days; changing the password logs everyone out.
 */

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 10;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function adminPassword(): string {
  return (process.env.ADMIN_PASSWORD || '').trim();
}

function tokenKey(): string {
  return crypto
    .createHash('sha256')
    .update(`tamam-admin:${adminPassword()}:${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`)
    .digest('hex');
}

function issueToken(): string {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  const sig = crypto.createHmac('sha256', tokenKey()).update(exp).digest('hex');
  return `${exp}.${sig}`;
}

function isValidToken(token: string | undefined): boolean {
  if (!token || !adminPassword()) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = crypto.createHmac('sha256', tokenKey()).update(exp).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function parseProductInput(body: any, partial = false): { value?: Partial<ManualProductInput>; error?: string } {
  const out: Partial<ManualProductInput> = {};

  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (title.length < 2 || title.length > 200) return { error: 'اسم المنتج مطلوب (من 2 إلى 200 حرف).' };
    out.title = title;
  }

  if (!partial || body.price !== undefined) {
    const price = Math.round(Number(body.price));
    if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) {
      return { error: 'سعر المنتج يجب أن يكون رقماً أكبر من صفر.' };
    }
    out.price = price;
  }

  if (!partial || body.images !== undefined) {
    const images = Array.isArray(body.images) ? body.images : [];
    const clean = images
      .map((u: any) => String(u || '').trim())
      .filter((u: string) => /^https:\/\/[^\s"'<>]+$/.test(u));
    if (clean.length === 0) return { error: 'أضف صورة واحدة على الأقل.' };
    if (clean.length > 10) return { error: 'الحد الأقصى 10 صور للمنتج.' };
    out.images = clean;
  }

  if (!partial || body.description !== undefined) {
    const description = String(body.description || '').trim();
    if (description.length > 10000) return { error: 'الوصف طويل جداً (الحد 10000 حرف).' };
    out.description = description || null;
  }

  if (!partial || body.sheet_target !== undefined) {
    if (body.sheet_target !== 'rolemall' && body.sheet_target !== 'other') {
      return { error: 'اختر الشيت الذي تصل إليه طلبات هذا المنتج.' };
    }
    out.sheet_target = body.sheet_target;
  }

  if (!partial || body.product_code !== undefined) {
    const code = String(body.product_code ?? '').trim();
    if (code.length > 64) return { error: 'معرف المنتج طويل جداً (الحد 64 حرف).' };
    if (code && !/^[\p{L}\p{N}_.\-\/# ]+$/u.test(code)) {
      return { error: 'معرف المنتج يقبل حروف وأرقام و - _ . / # فقط.' };
    }
    out.product_code = code || null;
  }

  if (!partial || body.is_active !== undefined) {
    out.is_active = body.is_active !== false;
  }

  return { value: out };
}

function parseId(raw: any): number | null {
  const s = String(raw ?? '').replace(MANUAL_ID_PREFIX, '');
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const handler: Handler = async (event) => {
  if (!adminPassword()) {
    return json(503, { error: 'لوحة التحكم غير مفعّلة: أضف ADMIN_PASSWORD في متغيرات Netlify.' });
  }
  if (adminPassword().length < MIN_PASSWORD_LENGTH) {
    return json(503, { error: `كلمة سر لوحة التحكم قصيرة. اجعل ADMIN_PASSWORD ${MIN_PASSWORD_LENGTH} أحرف على الأقل.` });
  }
  if (!isSupabaseConfigured()) {
    return json(503, { error: 'قاعدة البيانات غير مربوطة: أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في متغيرات Netlify.' });
  }

  const action = event.queryStringParameters?.action || '';
  let body: any = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'طلب غير صالح.' });
  }

  // ---- Login (no token needed) ----
  if (action === 'login') {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
    const ok = safeEqual(String(body.password || ''), adminPassword());
    if (!ok) {
      await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      return json(401, { error: 'كلمة السر غير صحيحة.' });
    }
    return json(200, { token: issueToken() });
  }

  // ---- Everything else requires a valid token ----
  const auth = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!isValidToken(token)) {
    return json(401, { error: 'انتهت الجلسة، سجّل الدخول مرة أخرى.' });
  }

  try {
    switch (action) {
      case 'sync': {
        if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
        const started = Date.now();
        const result = await syncFullCatalog();
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        if (!result.ok) {
          return json(502, { error: result.reason || 'فشلت مزامنة المنتجات.', result });
        }
        return json(200, { success: true, result, seconds });
      }

      case 'list': {
        const products = await adminListManualProducts();
        return json(200, { products });
      }

      case 'create': {
        if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
        const parsed = parseProductInput(body);
        if (parsed.error) return json(400, { error: parsed.error });
        const product = await adminCreateManualProduct(parsed.value as ManualProductInput);
        return json(200, { product });
      }

      case 'update': {
        if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
        const id = parseId(body.id);
        if (!id) return json(400, { error: 'رقم المنتج غير صالح.' });
        const parsed = parseProductInput(body, true);
        if (parsed.error) return json(400, { error: parsed.error });
        const product = await adminUpdateManualProduct(id, parsed.value || {});
        return json(200, { product });
      }

      case 'delete': {
        if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
        const id = parseId(body.id);
        if (!id) return json(400, { error: 'رقم المنتج غير صالح.' });
        await adminDeleteManualProduct(id);
        return json(200, { success: true });
      }

      case 'upload': {
        if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
        const contentType = String(body.contentType || '');
        const ext = ALLOWED_IMAGE_TYPES[contentType];
        if (!ext) return json(400, { error: 'نوع الصورة غير مدعوم (JPG أو PNG أو WEBP فقط).' });
        const bytes = Buffer.from(String(body.data || ''), 'base64');
        if (bytes.length === 0) return json(400, { error: 'الصورة فارغة.' });
        if (bytes.length > MAX_IMAGE_BYTES) return json(400, { error: 'حجم الصورة كبير جداً (الحد 4 ميغا).' });
        const url = await uploadProductImage(bytes, contentType, ext);
        return json(200, { url });
      }

      default:
        return json(404, { error: 'Unknown action' });
    }
  } catch (err: any) {
    console.error(`[admin] ${action} failed:`, err?.message || err);
    return json(500, { error: 'تعذر الاتصال بقاعدة البيانات، حاول مرة أخرى.' });
  }
};
