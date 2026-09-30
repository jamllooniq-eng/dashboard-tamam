import type { Handler } from '@netlify/functions';
import { getProducts } from '../../server/rolemall.server';
import { cachedHeaders, TAG_LISTING } from '../../server/cache.server';

export const handler: Handler = async (event) => {
  try {
    const page = Number(event.queryStringParameters?.page || 1);
    const limit = Number(event.queryStringParameters?.limit || 24);
    const category = event.queryStringParameters?.category;
    const query = event.queryStringParameters?.q;

    const result = await getProducts({ page, limit, category, query });

    // Never let the CDN keep an empty main listing (usually means the supplier was down)
    const isEmptyMainList = result.products.length === 0 && !category && !query;
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Product cards show prices: tagged "listing", purged whenever any price changes
        ...(isEmptyMainList ? { 'Cache-Control': 'no-store' } : cachedHeaders([TAG_LISTING])),
      },
      body: JSON.stringify(result),
    };
  } catch (err: any) {
    console.error('Error in Netlify function /api/products:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to fetch products' }),
    };
  }
};
