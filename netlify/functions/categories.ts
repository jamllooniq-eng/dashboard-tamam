import type { Handler } from '@netlify/functions';
import { getCategories } from '../../server/rolemall.server';

export const handler: Handler = async () => {
  try {
    const categories = await getCategories();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': categories.length === 0
          ? 'no-store'
          : 'public, max-age=120, s-maxage=600, stale-while-revalidate=1800',
      },
      body: JSON.stringify(categories),
    };
  } catch (err: any) {
    console.error('Error in Netlify function /api/categories:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to fetch categories' }),
    };
  }
};
