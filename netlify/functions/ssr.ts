import type { Handler } from '@netlify/functions';
import fs from 'fs';
import path from 'path';
import { render } from '../../src/entry-server';

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
      cachedTemplate = fs.readFileSync(p, 'utf-8');
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

    const isSuccess = (status || 200) === 200;
    const headers: Record<string, string> = {
      'Content-Type': 'text/html; charset=utf-8',
    };

    if (isSuccess) {
      headers['Cache-Control'] = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';
      headers['Netlify-CDN-Cache-Control'] = 'public, max-age=300, stale-while-revalidate=86400';
      headers['Netlify-Vary'] = 'query';
    } else {
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
