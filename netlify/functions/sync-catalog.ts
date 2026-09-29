import type { Handler } from '@netlify/functions';
import { syncFullCatalog } from '../../server/rolemall.server';
import { isSupabaseConfigured } from '../../server/supabase.server';

/**
 * Scheduled every hour (see netlify.toml).
 * Saves a full copy of the Rolemall catalog in Supabase, so every product stays
 * visible with its last known price if Rolemall goes down.
 */
export const handler: Handler = async () => {
  if (!isSupabaseConfigured()) {
    console.warn('[sync] Supabase is not configured; skipping catalog sync.');
    return { statusCode: 200, body: 'skipped' };
  }

  const started = Date.now();
  const result = await syncFullCatalog();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (result.ok) {
    console.log(`[sync] Saved ${result.products} products from ${result.pages} page(s) in ${seconds}s`);
  } else {
    console.warn(`[sync] Skipped saving (previous copy kept): ${result.reason} (${seconds}s)`);
  }
  return { statusCode: 200, body: JSON.stringify(result) };
};
