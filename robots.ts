import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  const baseUrl = process.env.APP_URL || 'https://tamam-iq.com';
  const robotsText = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin

Sitemap: ${baseUrl}/sitemap.xml
`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=7200',
    },
    body: robotsText,
  };
};
