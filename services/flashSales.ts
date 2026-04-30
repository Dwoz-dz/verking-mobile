/**
 * Flash sales service — reads active campaigns + the products inside.
 *
 * Strategy:
 *   ▸ `getActiveFlashSales()` reads `mobile_flash_sales` (RLS auto-
 *     filters expired/inactive rows) and joins each row's
 *     `product_ids[]` to a single `products` query, returning the rich
 *     ProductWithImages list mapped per sale.
 *   ▸ Discounted price is computed client-side from
 *     `discount_type` + `discount_value`. The original price stays
 *     visible (strikethrough) so the saving is obvious.
 */
import { useEffect, useState } from 'react';

import { subscribeRealtime } from '@/lib/realtime/realtimeHub';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { supabase } from '@/lib/supabase/client';
import type { ProductWithImages } from '@/types/database';

export type FlashSaleDiscountType = 'percent' | 'fixed';

export interface FlashSaleRow {
  id: string;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string | null;
  subtitle_ar: string | null;
  banner_image: string | null;
  discount_type: FlashSaleDiscountType;
  discount_value: number;
  product_ids: string[];
  max_qty_per_user: number;
  starts_at: string;
  ends_at: string;
  display_priority: number;
  target_wilayas: string[] | null;
}

export interface FlashSaleEnriched extends FlashSaleRow {
  /** Products belonging to this sale, with images and computed effective price. */
  products: (ProductWithImages & { flash_price: number; original_price: number })[];
}

const PRODUCT_COLUMNS =
  'id,name_fr,name_ar,description_fr,description_ar,price,sale_price,wholesale_price,' +
  'video_url,category_id,stock,is_featured,is_new,is_best_seller,is_promo,is_active,' +
  'show_on_homepage,show_in_featured,show_in_best_sellers,show_in_new_arrivals,' +
  'show_in_promotions,section_priority,sort_order,sku,tags,level,low_stock_threshold,' +
  'created_at,updated_at';

function applyFlashDiscount(row: { price: number; sale_price: number | null }, sale: { discount_type: FlashSaleDiscountType; discount_value: number }): number {
  // Start from whichever is currently the "effective" price the
  // catalogue displays, so a flash sale on top of a regular sale
  // stacks predictably.
  const base = typeof row.sale_price === 'number' && row.sale_price >= 0 ? row.sale_price : row.price;
  if (sale.discount_type === 'percent') {
    const d = (base * sale.discount_value) / 100;
    return Math.max(0, Math.round(base - d));
  }
  // fixed
  return Math.max(0, Math.round(base - sale.discount_value));
}

export async function getActiveFlashSales(): Promise<FlashSaleEnriched[]> {
  // Fetch the sales (RLS already filters active + window).
  const { data: salesData, error: salesErr } = await supabase
    .from('mobile_flash_sales')
    .select(
      'id,title_fr,title_ar,subtitle_fr,subtitle_ar,banner_image,' +
        'discount_type,discount_value,product_ids,max_qty_per_user,' +
        'starts_at,ends_at,display_priority,target_wilayas',
    )
    .order('display_priority', { ascending: false })
    .order('starts_at', { ascending: false });
  if (salesErr) {
    console.warn('[flashSales] fetch failed:', salesErr);
    return [];
  }
  const sales = ((salesData ?? []) as unknown) as FlashSaleRow[];
  if (sales.length === 0) return [];

  // Collect every product id from every sale into one fetch.
  const allIds = Array.from(
    new Set(sales.flatMap((s) => Array.isArray(s.product_ids) ? s.product_ids : [])),
  );
  if (allIds.length === 0) return sales.map((s) => ({ ...s, products: [] }));

  const [{ data: prodData, error: prodErr }, { data: imgData, error: imgErr }] = await Promise.all([
    supabase.from('products').select(PRODUCT_COLUMNS).in('id', allIds).eq('is_active', true),
    supabase
      .from('product_images')
      .select('id,product_id,url,sort_order,is_primary,created_at')
      .in('product_id', allIds),
  ]);
  if (prodErr) {
    console.warn('[flashSales] product fetch failed:', prodErr);
    return [];
  }
  if (imgErr) {
    console.warn('[flashSales] image fetch failed:', imgErr);
  }

  const byProduct = new Map<string, { id: string; product_id: string; url: string; sort_order: number | null; is_primary: boolean | null; created_at: string }[]>();
  for (const img of ((imgData ?? []) as unknown) as { id: string; product_id: string; url: string; sort_order: number | null; is_primary: boolean | null; created_at: string }[]) {
    const list = byProduct.get(img.product_id) ?? [];
    list.push(img);
    byProduct.set(img.product_id, list);
  }

  const productMap = new Map<string, ProductWithImages>();
  for (const raw of ((prodData ?? []) as unknown) as Record<string, unknown>[]) {
    const id = String(raw.id);
    const imgs = (byProduct.get(id) ?? []).slice().sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    productMap.set(id, {
      ...(raw as unknown as ProductWithImages),
      images: imgs,
      primaryImage: imgs[0]?.url ?? null,
    });
  }

  return sales.map((sale) => ({
    ...sale,
    products: sale.product_ids
      .map((pid) => productMap.get(pid))
      .filter((p): p is ProductWithImages => Boolean(p))
      .map((p) => {
        const original = typeof p.sale_price === 'number' && p.sale_price >= 0 ? p.sale_price : p.price;
        return {
          ...p,
          flash_price: applyFlashDiscount(p, sale),
          original_price: original,
        };
      }),
  }));
}

export function useActiveFlashSales(): { sales: FlashSaleEnriched[]; loading: boolean } {
  const [sales, setSales] = useState<FlashSaleEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await getActiveFlashSales();
      if (!cancelled) {
        setSales(list);
        setLoading(false);
      }
    })();

    // Realtime via hub: catalogue changes propagate without a restart.
    // Flash sales need full re-enrichment (price + product data), not
    // just a cache bump, so we subscribe specifically rather than rely
    // on the broad mobileConfigChannel.
    const unsub = subscribeRealtime('mobile_flash_sales', undefined, async () => {
      const fresh = await getActiveFlashSales();
      if (!cancelled) setSales(fresh);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [globalTick]);

  return { sales, loading };
}
