export interface RolemallProduct {
  id: string | number;
  title: string;
  price: number;
  old_price?: number | null;
  image: string;
  images?: string[];
  category?: string;
  category_id?: string | number;
  description?: string;
  vendor?: string;
  sku?: string;
  available?: boolean;
  stock?: number;
  features?: string[];
}

export interface RolemallCategory {
  id: string | number;
  name: string;
  slug?: string;
  image?: string;
  count?: number;
}

export interface ProductsResponse {
  products: RolemallProduct[];
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

export interface OrderPayload {
  orderId?: string;
  cus_name: string;
  cus_num1: string;
  capetel: string;
  address: string;
  note?: string;
  item_id: string | number;
  product_name: string;
  unit_price: number;
  count: number;
  all_price: number;
  fbc?: string;
  fbp?: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  message?: string;
  error?: string;
  duplicate?: boolean;
}

export type PolicyType = 'privacy' | 'terms' | 'returns' | 'about';

export interface SSRRoute {
  view: 'home' | 'product' | '404' | 'unavailable';
  productId?: string;
  category?: string;
  search?: string;
  page?: number;
}

export interface SSRData {
  route: SSRRoute;
  categories?: RolemallCategory[];
  products?: RolemallProduct[];
  hasMore?: boolean;
  page?: number;
  selectedProduct?: RolemallProduct | null;
  selectedCategory?: string;
  searchQuery?: string;
}
