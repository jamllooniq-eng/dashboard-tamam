import type { Handler } from '@netlify/functions';
import fs from 'fs';
import path from 'path';
import { render, MEANINGFUL_QUERY_PARAMS } from '../../src/entry-server';
import { parseRoute } from '../../src/routing';
import { cachedHeaders, productTag, TAG_LISTING, TAG_PAGES } from '../../server/cache.server';

/**
 * Put the stylesheet inside the HTML (<style>) instead of a separate <link> request.
 * The page can paint as soon as the HTML arrives, with no extra round trip (Lighthouse:
 * "Render-blocking requests"). If the CSS file can't be read, the original <link> is kept.
 */
function inlineStylesheets(html: string, templatePath: string): string {
  const clientDir = path.dirname(templatePath);
  return html.replace(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/g, (tag, href) => {
    try {
      const css = fs.readFileSync(path.join(clientDir, href), 'utf-8');
      if (!css || css.includes('</style')) return tag;
      return `<style>${css}</style>`;
    } catch {
      return tag;
    }
  });
}

let cachedTemplate: string | null = null;

function getTemplate(): string {
  if (cachedTemplate) {
    return cachedTemplate;
  }

  const possiblePaths = [
    path.resolve(process.cwd(), 'dist/client/index.html'),
    path.resolve(process.cwd(), 'dist/index.html'),
    path.resolve(process.cwd(), 'index.html'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      cachedTemplate = inlineStylesheets(fs.readFileSync(p, 'utf-8'), p);
      return cachedTemplate;
    }
  }

  throw new Error('Could not locate index.html template file');
}

export const handler: Handler = async (event) => {
  try {
    const rawQuery = event.rawQuery || (event.queryStringParameters ? new URLSearchParams(event.queryStringParameters as Record<string, string>).toString() : '');
    const fullUrl = event.path + (rawQuery ? `?${rawQuery}` : '');

    const proto = event.headers['x-forwarded-proto'] || 'https';
    const host = event.headers['host'] || 'localhost';
    const baseUrl = `${proto}://${host}`;

    const template = getTemplate();

    const { html, head, initialDataScript, status } = await render(fullUrl, baseUrl);

    const fullHtml = template
      .replace('<!--app-head-->', head || '')
      .replace('<!--app-html-->', html || '')
      .replace('<!--app-data-->', initialDataScript || '');

    const finalStatus = status || 200;
    const headers: Record<string, string> = {
      'Content-Type': 'text/html; charset=utf-8',
    };
    // Cache key = path + only the parameters that change the page.
    // An ad click (?fbclid=...) now shares the cached product page instead of forcing a fresh render.
    const vary = `query=${MEANINGFUL_QUERY_PARAMS.join('|')}`;

    if (finalStatus === 200) {
      // Ready page from Netlify's durable CDN cache (instant open). Tagged so a price change purges
      // exactly this product's page (see server/cache.server.ts); pages are re-rendered right after.
      const route = parseRoute(event.path, rawQuery ? `?${rawQuery}` : '');
      const tags =
        route.view === 'product' && route.productId
          ? [productTag(route.productId), TAG_PAGES]
          : route.view === 'home'
            ? [TAG_LISTING, TAG_PAGES]
            : [TAG_PAGES];
      Object.assign(headers, cachedHeaders(tags));
      headers['Netlify-Vary'] = vary;
    } else if (finalStatus === 404) {
      // Not Found is stable: keep it at the CDN for a few minutes so repeated bot hits never reach the function
      headers['Cache-Control'] = 'public, max-age=60';
      headers['Netlify-CDN-Cache-Control'] = 'public, max-age=600';
      headers['Netlify-Vary'] = vary;
    } else {
      // 503 / 500: temporary, never cached
      headers['Cache-Control'] = 'no-store';
    }

    return {
      statusCode: status || 200,
      headers,
      body: fullHtml,
    };
  } catch (err: any) {
    console.error('Error in Netlify SSR function:', err);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>حدث خطأ | تمام شوب</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #f8fafc; color: #1e293b; text-align: center; padding: 20px; }
    .box { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); max-width: 480px; }
    h1 { margin-top: 0; font-size: 24px; color: #0f172a; }
    p { margin-bottom: 24px; color: #64748b; font-size: 14px; }
    a { display: inline-block; background: #22A39E; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="box">
    <h1>حدث خطأ أثناء تحميل الصفحة</h1>
    <p>يرجى إعادة المحاولة بعد قليل أو العودة للصفحة الرئيسية.</p>
    <a href="/">العودة للرئيسية</a>
  </div>
</body>
</html>`,
    };
  }
};
