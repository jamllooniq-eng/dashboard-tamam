import type { Handler } from '@netlify/functions';
import { syncFullCatalog } from '../../server/rolemall.server';
import { isSupabaseConfigured } from '../../server/supabase.server';
import { refreshPagesAfterSync } from '../../server/page-refresh.server';

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
    // Refresh only the cached pages whose product changed (price, availability, title, image)
    const refresh = await refreshPagesAfterSync(result, { maxWarm: 10, deadlineMs: 15000 });
    if (refresh.changed > 0 || refresh.purge) {
      console.log(
        `[sync] ${refresh.changed} product(s) changed | cache purge: ${refresh.purge ? (refresh.purge.ok ? 'ok' : `FAILED (${refresh.purge.error})`) : 'not needed'} | pages re-rendered: ${refresh.warmed}`
      );
    }
  } else {
    console.warn(`[sync] Skipped saving (previous copy kept): ${result.reason} (${seconds}s)`);
  }
  return { statusCode: 200, body: JSON.stringify(result) };
};
