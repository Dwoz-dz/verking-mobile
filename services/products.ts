/**
 * Product service — reads products and product images from Supabase.
 */
import { supabase } from '@/lib/supabase/client';
import type { ProductImageRow, ProductRow, ProductWithImages } from '@/types/database';

export interface ListProductsOptions {
  categoryId?: string | null;
  featuredOnly?: boolean;
  newOnly?: boolean;
  bestSellerOnly?: boolean;
  promoOnly?: boolean;
  homepageOnly?: boolean;
  /** Only products that have a wholesale_price set (>0). */
  wholesaleOnly?: boolean;
  /** Only products with sale_price < price (real promo). */
  dealsOnly?: boolean;
  limit?: number;
  search?: string;
}

const PRODUCT_COLUMNS =
  'id,name_fr,name_ar,description_fr,description_ar,price,sale_price,wholesale_price,' +
  'video_url,category_id,stock,is_featured,is_new,is_best_seller,is_promo,is_active,' +
  'show_on_homepage,show_in_featured,show_in_best_sellers,show_in_new_arrivals,' +
  'show_in_promotions,section_priority,sort_order,sku,tags,level,low_stock_threshold,' +
  'created_at,updated_at';

function attachImages(
  products: ProductRow[],
  images: ProductImageRow[],
): ProductWithImages[] {
  const byProduct = new Map<string, ProductImageRow[]>();
  for (const img of images) {
    const list = byProduct.get(img.product_id) ?? [];
    list.push(img);
    byProduct.set(img.product_id, list);
  }
  return products.map((p) => {
    const imgs = (byProduct.get(p.id) ?? []).slice().sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    return { ...p, images: imgs, primaryImage: imgs[0]?.url ?? null };
  });
}

export async function listProducts(opts: ListProductsOptions = {}): Promise<ProductWithImages[]> {
  let query = supabase.from('products').select(PRODUCT_COLUMNS).eq('is_active', true);
  if (opts.categoryId) query = query.eq('category_id', opts.categoryId);
  if (opts.featuredOnly) query = query.eq('is_featured', true);
  if (opts.newOnly) query = query.eq('is_new', true);
  if (opts.bestSellerOnly) query = query.eq('is_best_seller', true);
  if (opts.promoOnly) query = query.eq('is_promo', true);
  if (opts.homepageOnly) query = query.eq('show_on_homepage', true);
  if (opts.wholesaleOnly) query = query.gt('wholesale_price', 0);
  if (opts.dealsOnly) query = query.not('sale_price', 'is', null);
  if (opts.search) query = query.ilike('name_fr', `%${opts.search}%`);
  query = query
    .order('section_priority', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (opts.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  let products = ((data ?? []) as unknown) as ProductRow[];
  if (opts.dealsOnly) {
    products = products.filter(
      (p) => p.sale_price != null && p.sale_price < p.price && p.price > 0,
    );
  }
  if (products.length === 0) return [];
  const ids = products.map((p) => p.id);
  const { data: imgData, error: imgErr } = await supabase
    .from('product_images')
    .select('id,product_id,url,sort_order,is_primary,created_at')
    .in('product_id', ids);
  if (imgErr) throw imgErr;
  return attachImages(products, ((imgData ?? []) as unknown) as ProductImageRow[]);
}

export async function getProduct(id: string): Promise<ProductWithImages | null> {
  const { data, error } = await supabase
    .from('products').select(PRODUCT_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: imgData, error: imgErr } = await supabase
    .from('product_images')
    .select('id,product_id,url,sort_order,is_primary,created_at')
    .eq('product_id', id);
  if (imgErr) throw imgErr;
  const [enriched] = attachImages(
    [(data as unknown) as ProductRow],
    ((imgData ?? []) as unknown) as ProductImageRow[],
  );
  return enriched;
}

export async function listFeaturedProducts(limit = 8): Promise<ProductWithImages[]> {
  const featured = await listProducts({ featuredOnly: true, limit });
  if (featured.length > 0) return featured;
  const homepage = await listProducts({ homepageOnly: true, limit });
  if (homepage.length > 0) return homepage;
  return listProducts({ limit });
}

export async function listNewArrivals(limit = 8): Promise<ProductWithImages[]> {
  const items = await listProducts({ newOnly: true, limit });
  if (items.length > 0) return items;
  return listProducts({ limit });
}

export async function listBestSellers(limit = 8): Promise<ProductWithImages[]> {
  const items = await listProducts({ bestSellerOnly: true, limit });
  if (items.length > 0) return items;
  return listProducts({ limit });
}

export async function listDealsOfTheDay(limit = 8): Promise<ProductWithImages[]> {
  const items = await listProducts({ dealsOnly: true, limit });
  if (items.length > 0) return items;
  return listProducts({ promoOnly: true, limit });
}

export async function listWholesaleDeals(limit = 8): Promise<ProductWithImages[]> {
  return listProducts({ wholesaleOnly: true, limit });
}

/**
 * Fetch many products by id in a single round-trip. Used by the
 * "Vu récemment" rail. Order of returned array preserves input order.
 * Inactive / deleted products silently drop out.
 */
export async function listProductsByIds(ids: string[]): Promise<ProductWithImages[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('products').select(PRODUCT_COLUMNS).in('id', ids).eq('is_active', true);
  if (error) throw error;
  const products = ((data ?? []) as unknown) as ProductRow[];
  if (products.length === 0) return [];
  const { data: imgData, error: imgErr } = await supabase
    .from('product_images')
    .select('id,product_id,url,sort_order,is_primary,created_at')
    .in('product_id', products.map((p) => p.id));
  if (imgErr) throw imgErr;
  const enriched = attachImages(products, ((imgData ?? []) as unknown) as ProductImageRow[]);
  const order = new Map(ids.map((id, index) => [id, index]));
  return enriched.sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
}

export async function listRecommended(limit = 8): Promise<ProductWithImages[]> {
  const all = await listProducts({ limit: limit * 3 });
  if (all.length <= limit) return all;
  const arr = [...all];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, limit);
}
