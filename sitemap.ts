import type { Handler } from '@netlify/functions';
import { getCategories, getProducts } from '../../server/rolemall.server';

export const handler: Handler = async () => {
  try {
    const baseUrl = process.env.APP_URL || 'https://tamam-iq.com';
    const [categories, productsData] = await Promise.all([
      getCategories(),
      getProducts({ limit: 100 }),
    ]);

    const now = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

    for (const cat of categories) {
      xml += `
  <url>
    <loc>${baseUrl}/?category=${encodeURIComponent(String(cat.id))}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    for (const prod of productsData.products) {
      xml += `
  <url>
    <loc>${baseUrl}/product/${prod.id}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
    }

    xml += `\n</urlset>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=7200',
      },
      body: xml,
    };
  } catch (err: any) {
    console.error('Error generating sitemap in Netlify function:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: 'Error generating sitemap',
    };
  }
};
