/**
 * Supabase (server-only) helper
 * - Persistent "last known good" cache for Rolemall data (survives Netlify cold starts & Rolemall outages)
 * - Manual products added from the /admin dashboard
 * - Product image storage
 *
 * Uses the Supabase REST API directly with the service key, which lives ONLY in
 * Netlify environment variables. Tables have RLS enabled with no public policies,
 * so nothing is readable from the browser except the public image bucket.
 */

import { RolemallProduct } from '../src/types';

export type SheetTarget = 'rolemall' | 'other';

export interface ManualProductRow {
  id: number;
  title: string;
  price: number;
  description: string | null;
  images: string[];
  sheet_target: SheetTarget;
  /** Optional code written to the sheet's "معرف المنتج" column instead of m-<id> */
  product_code: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const MANUAL_ID_PREFIX = 'm-';
export const IMAGE_BUCKET = 'product-images';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { apikey: SUPABASE_KEY };
  // Legacy service_role keys are JWTs and also go in Authorization.
  // New-style secret keys (sb_secret_...) only need the apikey header.
  if (SUPABASE_KEY.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  }
  return headers;
}

async function sbFetch(pathAndQuery: string, init: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${SUPABASE_URL}${pathAndQuery}`, {
      ...init,
      signal: controller.signal,
      headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Persistent cache (key/value)
// ---------------------------------------------------------------------------

export async function kvGet<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const res = await sbFetch(
      `/rest/v1/cache_entries?key=eq.${encodeURIComponent(key)}&select=data,updated_at&limit=1`,
      {},
      3000
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return { data: rows[0].data as T, timestamp: new Date(rows[0].updated_at).getTime() };
  } catch {
    return null;
  }
}

export async function kvSet<T>(key: string, data: T, timestamp = Date.now()): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await sbFetch('/rest/v1/cache_entries?on_conflict=key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ key, data, updated_at: new Date(timestamp).toISOString() }),
    });
  } catch {
    // Best effort only: the site keeps working from memory/disk cache
  }
}

/** Upsert many cache rows in one request (used by the hourly catalog sync). */
export async function kvSetMany(entries: { key: string; data: unknown }[], timestamp = Date.now()): Promise<boolean> {
  if (!isSupabaseConfigured() || entries.length === 0) return true;
  const updated_at = new Date(timestamp).toISOString();
  try {
    const res = await sbFetch(
      '/rest/v1/cache_entries?on_conflict=key',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(entries.map((e) => ({ key: e.key, data: e.data, updated_at }))),
      },
      15000
    );
    if (!res.ok) {
      console.error(`[Supabase] batch upsert failed (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[Supabase] batch upsert error:', err?.message || err);
    return false;
  }
}

/** Delete cache rows (used when a product no longer exists at the supplier). */
export async function kvDeleteMany(keys: string[]): Promise<void> {
  if (!isSupabaseConfigured() || keys.length === 0) return;
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100).map((k) => `"${k.replace(/"/g, '')}"`).join(',');
    try {
      await sbFetch(`/rest/v1/cache_entries?key=in.(${encodeURIComponent(chunk)})`, { method: 'DELETE' }, 10000);
    } catch {
      // best effort
    }
  }
}

// ---------------------------------------------------------------------------
// Manual products
// ---------------------------------------------------------------------------

const MANUAL_COLUMNS = 'id,title,price,description,images,sheet_target,product_code,is_active,created_at,updated_at';
const MANUAL_CACHE_TTL_MS = 60 * 1000;
let manualCache: { rows: ManualProductRow[]; timestamp: number } | null = null;

function sanitizeRow(raw: any): ManualProductRow {
  return {
    id: Number(raw.id),
    title: String(raw.title || ''),
    price: Number(raw.price) || 0,
    description: raw.description ? String(raw.description) : null,
    images: Array.isArray(raw.images) ? raw.images.filter((u: any) => typeof u === 'string' && u) : [],
    sheet_target: raw.sheet_target === 'rolemall' ? 'rolemall' : 'other',
    product_code: raw.product_code ? String(raw.product_code) : null,
    is_active: raw.is_active !== false,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export function manualRowToProduct(row: ManualProductRow): RolemallProduct {
  const images = row.images || [];
  return {
    id: `${MANUAL_ID_PREFIX}${row.id}`,
    title: row.title,
    price: row.price,
    old_price: null,
    image: images[0] || '',
    images,
    description: row.description || undefined,
    available: row.is_active,
  };
}

export function parseManualId(id: string | number): number | null {
  const s = String(id).trim();
  if (!s.startsWith(MANUAL_ID_PREFIX)) return null;
  const n = Number(s.slice(MANUAL_ID_PREFIX.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Active manual products for the storefront (cached ~60s per function instance). */
export async function listActiveManualProducts(): Promise<ManualProductRow[]> {
  if (!isSupabaseConfigured()) return [];
  const now = Date.now();
  if (manualCache && now - manualCache.timestamp < MANUAL_CACHE_TTL_MS) {
    return manualCache.rows;
  }
  try {
    const res = await sbFetch(
      `/rest/v1/manual_products?is_active=eq.true&select=${MANUAL_COLUMNS}&order=created_at.desc`,
      {},
      3000
    );
    if (res.ok) {
      const rows = ((await res.json()) as any[]).map(sanitizeRow);
      manualCache = { rows, timestamp: now };
      return rows;
    }
  } catch {
    // fall through to stale cache
  }
  return manualCache?.rows || [];
}

/** One manual product, always fresh (used for product pages and to verify price at checkout). */
export async function getManualProduct(id: number): Promise<{ row: ManualProductRow | null; failed: boolean }> {
  if (!isSupabaseConfigured()) return { row: null, failed: true };
  try {
    const res = await sbFetch(`/rest/v1/manual_products?id=eq.${id}&select=${MANUAL_COLUMNS}&limit=1`, {}, 4000);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const rows = await res.json();
    return { row: Array.isArray(rows) && rows[0] ? sanitizeRow(rows[0]) : null, failed: false };
  } catch {
    const cached = manualCache?.rows.find((r) => r.id === id) || null;
    return { row: cached, failed: !cached };
  }
}

// ---- Admin CRUD ----

export async function adminListManualProducts(): Promise<ManualProductRow[]> {
  const res = await sbFetch(`/rest/v1/manual_products?select=${MANUAL_COLUMNS}&order=created_at.desc`);
  if (!res.ok) throw new Error(`Supabase list failed (${res.status}): ${await res.text()}`);
  return ((await res.json()) as any[]).map(sanitizeRow);
}

export interface ManualProductInput {
  title: string;
  price: number;
  description: string | null;
  images: string[];
  sheet_target: SheetTarget;
  product_code: string | null;
  is_active: boolean;
}

export async function adminCreateManualProduct(input: ManualProductInput): Promise<ManualProductRow> {
  const res = await sbFetch('/rest/v1/manual_products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Supabase insert failed (${res.status}): ${await res.text()}`);
  manualCache = null;
  const rows = await res.json();
  return sanitizeRow(rows[0]);
}

export async function adminUpdateManualProduct(id: number, input: Partial<ManualProductInput>): Promise<ManualProductRow> {
  const res = await sbFetch(`/rest/v1/manual_products?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ ...input, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase update failed (${res.status}): ${await res.text()}`);
  manualCache = null;
  const rows = await res.json();
  if (!rows[0]) throw new Error('Product not found');
  return sanitizeRow(rows[0]);
}

export async function adminDeleteManualProduct(id: number): Promise<void> {
  const res = await sbFetch(`/rest/v1/manual_products?id=eq.${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Supabase delete failed (${res.status}): ${await res.text()}`);
  manualCache = null;
}

// ---- Images ----

export async function uploadProductImage(bytes: Buffer, contentType: string, extension: string): Promise<string> {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const res = await sbFetch(
    `/storage/v1/object/${IMAGE_BUCKET}/${name}`,
    {
      method: 'POST',
      headers: { 'Content-Type': contentType, 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' },
      body: bytes,
    },
    20000
  );
  if (!res.ok) throw new Error(`Image upload failed (${res.status}): ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${name}`;
}
