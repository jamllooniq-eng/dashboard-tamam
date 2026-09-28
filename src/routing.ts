export interface ParsedRoute {
  view: 'home' | 'product' | '404' | 'unavailable';
  productId?: string;
  category?: string;
  search?: string;
  page?: number;
}

/**
 * Pure Isomorphic route parser
 * Does NOT use window or document, runs identically in Node (SSR) and Browser (Client)
 */
export function parseRoute(
  pathname: string = '/',
  searchParamsInput?: URLSearchParams | Record<string, string> | string
): ParsedRoute {
  // Normalize pathname: remove trailing slash except root
  const cleanPath = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;

  let searchParams: URLSearchParams;
  if (searchParamsInput instanceof URLSearchParams) {
    searchParams = searchParamsInput;
  } else if (typeof searchParamsInput === 'string') {
    searchParams = new URLSearchParams(
      searchParamsInput.startsWith('?') ? searchParamsInput.slice(1) : searchParamsInput
    );
  } else if (searchParamsInput && typeof searchParamsInput === 'object') {
    searchParams = new URLSearchParams(searchParamsInput);
  } else {
    searchParams = new URLSearchParams();
  }

  // 1. Product Route: /product/:id
  const productMatch = cleanPath.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    const rawId = decodeURIComponent(productMatch[1]).trim();
    if (rawId) {
      return {
        view: 'product',
        productId: rawId,
      };
    }
  }

  // 2. Home Route: / or /index.html
  if (cleanPath === '' || cleanPath === '/' || cleanPath === '/index.html') {
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('q') || searchParams.get('search') || undefined;
    const pageParam = searchParams.get('page');
    const page = pageParam && !isNaN(Number(pageParam)) && Number(pageParam) > 0 ? Number(pageParam) : 1;

    return {
      view: 'home',
      category: category ? decodeURIComponent(category).trim() : undefined,
      search: search ? decodeURIComponent(search).trim() : undefined,
      page,
    };
  }

  // 3. Fallback / 404 for unknown non-API paths
  return {
    view: '404',
  };
}
