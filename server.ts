/**
 * TAMAM SHOP Server Entry Point
 * Full-stack Express + Vite SSR with Server-Side Rolemall Adapter,
 * Secure Image Proxy, Direct Checkout, Meta CAPI, and Dynamic SEO
 */

import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { createServer as createViteServer, ViteDevServer } from 'vite';
import dotenv from 'dotenv';
import { getCategories, getProducts, getProductDetails } from './server/rolemall.server';
import { processOrder } from './server/checkout.server';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Middleware for JSON & form body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health Check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', store: 'TAMAM SHOP (تمام شوب)' });
  });

  // Local / Express Proxy for Netlify Image CDN (/.netlify/images) in Development & Self-hosted environments
  app.get('/.netlify/images', async (req: Request, res: Response) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        res.status(400).send('Missing url parameter');
        return;
      }

      // Ensure URL is valid and from allowed Rolemall domains
      const parsed = new URL(imageUrl);
      const allowedHosts = ['mojod.app', 'rolemall.com', 'supabase.co'];
      const isAllowed = allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));

      if (!isAllowed) {
        res.status(403).send('Forbidden image domain');
        return;
      }

      // Fetch upstream image with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const imgRes = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'TamamShop/1.0',
        },
      });
      clearTimeout(timeout);

      if (!imgRes.ok) {
        res.status(imgRes.status).send('Failed to fetch image');
        return;
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');

      const arrayBuffer = await imgRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.warn('Notice: Local image proxy issue:', err?.message || err);
      res.status(502).send('Error proxying image');
    }
  });

  // Rolemall Categories API
  app.get('/api/categories', async (_req: Request, res: Response) => {
    try {
      const categories = await getCategories();
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400');
      res.setHeader('Netlify-CDN-Cache-Control', 'public, max-age=1800, stale-while-revalidate=86400');
      res.json(categories);
    } catch (err: any) {
      console.error('Error in /api/categories:', err);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Rolemall Products API
  app.get('/api/products', async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 24);
      const category = req.query.category ? String(req.query.category) : undefined;
      const query = req.query.q ? String(req.query.q) : undefined;

      const result = await getProducts({ page, limit, category, query });
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
      res.setHeader('Netlify-CDN-Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
      res.json(result);
    } catch (err: any) {
      console.error('Error in /api/products:', err);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // Product Details API
  app.get(['/api/product-details/:id', '/api/product-details'], async (req: Request, res: Response) => {
    try {
      const productId = req.params.id || (req.query.id as string);
      if (!productId) {
        res.status(400).json({ error: 'Missing product id parameter' });
        return;
      }
      const result = await getProductDetails(productId);
      if (result.status === 'found' && result.product) {
        res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=86400');
        res.setHeader('Netlify-CDN-Cache-Control', 'public, max-age=600, stale-while-revalidate=86400');
        res.json(result.product);
        return;
      }
      if (result.status === 'not_found') {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      res.status(503).json({ error: 'Product temporarily unavailable' });
    } catch (err: any) {
      console.error(`Error in /api/product-details:`, err);
      res.status(500).json({ error: 'Failed to fetch product details' });
    }
  });

  // Direct Checkout Processing
  app.post('/api/checkout', async (req: Request, res: Response) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await processOrder(req.body, { clientIp, userAgent });
      if (!result.success) {
        res.status(result.duplicate ? 409 : 400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (err: any) {
      console.error('Checkout error:', err);
      res.status(500).json({ success: false, error: 'حدث خطأ أثناء معالجة الطلب، يرجى المحاولة لاحقاً.' });
    }
  });

  // Safe Meta Pixel Config for Frontend
  app.get('/api/meta-config', (_req: Request, res: Response) => {
    res.json({
      pixelId: process.env.META_PIXEL_ID || '',
    });
  });

  // Dynamic Sitemap
  app.get('/sitemap.xml', async (_req: Request, res: Response) => {
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

      res.setHeader('Content-Type', 'application/xml');
      res.send(xml);
    } catch (err) {
      res.status(500).send('Error generating sitemap');
    }
  });

  // Robots.txt
  app.get('/robots.txt', (_req: Request, res: Response) => {
    const baseUrl = process.env.APP_URL || 'https://tamam-iq.com';
    const robots = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`;
    res.setHeader('Content-Type', 'text/plain');
    res.send(robots);
  });

  // Vite Dev Server / Static Production Config
  let vite: ViteDevServer | undefined;
  const distPath = path.join(process.cwd(), 'dist');

  if (!isProd) {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static client assets from dist/client
    app.use(express.static(path.join(distPath, 'client'), { index: false }));
  }

  // Catch-all SSR Route Handler (Excluding /api/* and /.netlify/*)
  app.use('*', async (req: Request, res: Response, next) => {
    const url = req.originalUrl;
    if (url.startsWith('/api/') || url.startsWith('/.netlify/')) {
      return next();
    }

    try {
      let template: string;
      let render: (url: string, baseUrl?: string) => Promise<{
        html: string;
        head: string;
        initialDataScript: string;
        status: number;
      }>;

      const host = req.get('host') || 'localhost:3000';
      const baseUrl = `${req.protocol}://${host}`;

      if (vite) {
        // Development Mode: Read raw index.html and transform via Vite
        const templatePath = path.resolve(process.cwd(), 'index.html');
        const rawTemplate = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, rawTemplate);

        const ssrModule = await vite.ssrLoadModule('/src/entry-server.tsx');
        render = ssrModule.render;
      } else {
        // Production Mode: Read built client index.html & import compiled SSR module
        const templatePath = path.resolve(distPath, 'client/index.html');
        template = fs.readFileSync(templatePath, 'utf-8');

        const serverEntryPath = path.resolve(distPath, 'server/entry-server.js');
        const ssrModule = await import(pathToFileURL(serverEntryPath).href);
        render = ssrModule.render;
      }

      const { html, head, initialDataScript, status } = await render(url, baseUrl);

      // Inject SSR Head, Body HTML, and Initial Data Script into HTML template
      const fullHtml = template
        .replace('<!--app-head-->', head)
        .replace('<!--app-html-->', html)
        .replace('<!--app-data-->', initialDataScript);

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

      res.status(status || 200).set(headers).send(fullHtml);
    } catch (err: any) {
      if (vite) {
        vite.ssrFixStacktrace(err);
      }
      console.error(`[SSR] Render failed for "${url}":`, err);
      next(err);
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TAMAM SHOP] Server running on http://0.0.0.0:${PORT} (${isProd ? 'Production SSR' : 'Development SSR'})`);
    
    // Background warmup for instant fast response
    setTimeout(() => {
      getCategories()
        .then(() => getProducts({ limit: 24 }))
        .catch((e) => console.warn('[Warmup] Initial cache preload notice:', e?.message || e));
    }, 500);
  });
}

startServer();
