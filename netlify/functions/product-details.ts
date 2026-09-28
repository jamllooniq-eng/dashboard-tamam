import type { Handler } from '@netlify/functions';
import { getProductDetails } from '../../server/rolemall.server';

export const handler: Handler = async (event) => {
  try {
    const productId = event.queryStringParameters?.id;
    if (!productId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Missing product id parameter' }),
      };
    }

    const result = await getProductDetails(productId);
    if (result.status === 'found' && result.product) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=120, s-maxage=600, stale-while-revalidate=86400',
          'Netlify-CDN-Cache-Control': 'public, max-age=600, stale-while-revalidate=86400',
        },
        body: JSON.stringify(result.product),
      };
    }

    if (result.status === 'not_found') {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Product not found' }),
      };
    }

    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Product temporarily unavailable' }),
    };
  } catch (err: any) {
    console.error('Error in Netlify function /api/product-details:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to fetch product details' }),
    };
  }
};
