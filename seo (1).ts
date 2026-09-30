import { RolemallProduct } from '../types';

export function updatePageSEO(title: string, description?: string, image?: string): void {
  if (typeof document === 'undefined') return;

  const siteName = 'تمام شوب | TAMAM SHOP';
  document.title = title ? `${title} | ${siteName}` : siteName;

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription && description) {
    metaDescription.setAttribute('content', description.slice(0, 160));
  }

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    ogTitle.setAttribute('content', title ? `${title} | ${siteName}` : siteName);
  }

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc && description) {
    ogDesc.setAttribute('content', description.slice(0, 160));
  }

  if (image) {
    let ogImage = document.querySelector('meta[property="og:image"]');
    if (!ogImage) {
      ogImage = document.createElement('meta');
      ogImage.setAttribute('property', 'og:image');
      document.head.appendChild(ogImage);
    }
    ogImage.setAttribute('content', image);
  }
}

export function injectProductJsonLd(product: RolemallProduct): void {
  if (typeof document === 'undefined') return;

  const existingScript = document.getElementById('product-schema-jsonld');
  if (existingScript) {
    existingScript.remove();
  }

  const cleanDescription = (product.description || product.title)
    .replace(/<[^>]*>?/gm, '')
    .slice(0, 250);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: product.image,
    description: cleanDescription,
    sku: product.sku || String(product.id),
    ...(product.vendor ? { brand: { '@type': 'Brand', name: product.vendor } } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'IQD',
      price: product.price,
      availability: product.available === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      url: typeof window !== 'undefined' ? window.location.href : '',
      seller: {
        '@type': 'Organization',
        name: 'تمام شوب'
      }
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'الرئيسية',
          item: typeof window !== 'undefined' ? window.location.origin : ''
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: product.category || 'المنتجات',
          item: typeof window !== 'undefined' ? `${window.location.origin}/#products` : ''
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: product.title,
          item: typeof window !== 'undefined' ? window.location.href : ''
        }
      ]
    }
  };

  const script = document.createElement('script');
  script.id = 'product-schema-jsonld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}
