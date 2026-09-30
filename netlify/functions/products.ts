import type { Handler } from '@netlify/functions';
import { getProducts } from '../../server/rolemall.server';

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
        'Cache-Control': isEmptyMainList ? 'no-store' : 'public, max-age=0, must-revalidate',
        // Product cards show prices: at most 60s at Netlify, never an expired copy
        ...(isEmptyMainList ? {} : { 'Netlify-CDN-Cache-Control': 'public, max-age=60' }),
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
