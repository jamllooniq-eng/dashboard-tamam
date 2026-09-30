import type { Handler } from '@netlify/functions';
import { warmAfterDeploy } from '../../server/page-refresh.server';

/**
 * Runs automatically after every successful deploy (Netlify event-triggered function;
 * Netlify signs these calls, so it can't be triggered from outside).
 *
 * A new deploy starts with an empty CDN cache. This pre-renders the home page, every manual
 * product and the first products (plus their main images) so the first ad visitors after a
 * deploy don't wait for the server.
 */
export const handler: Handler = async (event) => {
  let context = 'production';
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    context = body?.payload?.context || context;
  } catch {
    // unknown payload shape: assume production
  }
  if (context !== 'production') {
    return { statusCode: 200, body: `skipped (${context})` };
  }

  const started = Date.now();
  const warmed = await warmAfterDeploy();
  console.log(`[deploy-warm] pre-rendered ${warmed} page(s) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return { statusCode: 200, body: JSON.stringify({ warmed }) };
};
