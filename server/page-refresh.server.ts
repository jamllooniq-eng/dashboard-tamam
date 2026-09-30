/**
 * Keeps the CDN full of ready pages with correct prices:
 * - after a catalog sync: purge + re-render only the products that changed (and the product cards)
 * - after a dashboard edit: purge + re-render that manual product
 * - after a deploy: pre-render the home page, every manual product and the first products
 */

import { purgeTags, warmTargets, productTag, TAG_LISTING, PurgeStatus, WarmTarget } from './cache.server';
import { CatalogSyncResult, getProducts } from './rolemall.server';
import { listActiveManualProducts, MANUAL_ID_PREFIX } from './supabase.server';

// Server copies notice a sync / dashboard change within 5s; re-render only after that,
// otherwise a copy that hasn't noticed yet could put the old price back into the CDN.
const REFRESH_DELAY_MS = 6500;

export interface RefreshResult {
  changed: number;
  purge: PurgeStatus | null;
  warmed: number;
}

/** After a successful sync: refresh exactly the pages whose content changed. */
export async function refreshPagesAfterSync(
  result: CatalogSyncResult,
  options: { maxWarm?: number; deadlineMs?: number } = {}
): Promise<RefreshResult> {
  const changed = result.ok ? result.changed || [] : [];
  if (!result.ok || (changed.length === 0 && !result.listingChanged)) {
    return { changed: 0, purge: null, warmed: 0 };
  }
  const tags = changed.map((c) => productTag(c.id));
  if (result.listingChanged) tags.push(TAG_LISTING);

  const purge = await purgeTags(tags);
  let warmed = 0;
  if (purge.ok) {
    const targets: WarmTarget[] = [
      { path: '/' },
      ...changed.filter((c) => c.image).map((c) => ({ path: `/product/${c.id}`, image: c.image })),
    ];
    warmed = await warmTargets(targets, { delayMs: REFRESH_DELAY_MS, maxTargets: options.maxWarm ?? 10, deadlineMs: options.deadlineMs });
  }
  return { changed: changed.length, purge, warmed };
}

/** After adding / editing / hiding / deleting a manual product in the dashboard. */
export async function refreshManualProduct(id: number, image?: string, stillVisible = true): Promise<PurgeStatus> {
  const productId = `${MANUAL_ID_PREFIX}${id}`;
  const purge = await purgeTags([productTag(productId), TAG_LISTING]);
  if (purge.ok) {
    const targets: WarmTarget[] = [{ path: '/' }];
    if (stillVisible) targets.push({ path: `/product/${productId}`, image });
    await warmTargets(targets, { delayMs: REFRESH_DELAY_MS, deadlineMs: 20000 });
  }
  return purge;
}

/** After each deploy (the deploy starts with an empty CDN cache): pre-render what customers open first. */
export async function warmAfterDeploy(): Promise<number> {
  const targets: WarmTarget[] = [{ path: '/' }];
  try {
    const manual = await listActiveManualProducts();
    for (const m of manual) targets.push({ path: `/product/${MANUAL_ID_PREFIX}${m.id}`, image: m.images[0] });
  } catch {
    // Supabase unavailable: skip manual products
  }
  try {
    const first = await getProducts({ limit: 24 });
    for (const p of first.products) targets.push({ path: `/product/${p.id}`, image: p.image });
  } catch {
    // Rolemall unavailable: the home page alone is still warmed
  }
  return warmTargets(targets, { maxTargets: 40, deadlineMs: 40000 });
}
