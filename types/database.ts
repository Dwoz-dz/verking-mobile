/**
 * Hand-written typed schema for the VERKING Supabase database.
 *
 * Mirrors the actual columns of the existing tables used by the website/admin
 * dashboard. Only the tables that the mobile app touches directly are typed in
 * full; everything else can be added incrementally.
 *
 * If the schema drifts from the website, regenerate using:
 *   npx supabase gen types typescript --project-id <ref> --schema public
 * and replace this file.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface CategoryRow {
  id: string;
  name_fr: string;
  name_ar: string | null;
  slug: string;
  image: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  show_on_homepage: boolean | null;
  short_description_fr: string | null;
  short_description_ar: string | null;
  featured: boolean | null;
  mobile_icon: string | null;
  badge_color: string | null;
  card_style: string | null;
  created_at: string | null;
}

export interface ProductRow {
  id: string;
  name_fr: string;
  name_ar: string | null;
  description_fr: string | null;
  description_ar: string | null;
  price: number;
  sale_price: number | null;
  /** Added via mobile-app migration `add_wholesale_price_to_products`. */
  wholesale_price: number | null;
  video_url: string | null;
  category_id: string | null;
  stock: number | null;
  is_featured: boolean | null;
  is_new: boolean | null;
  is_best_seller: boolean | null;
  is_promo: boolean | null;
  is_active: boolean | null;
  show_on_homepage: boolean | null;
  show_in_featured: boolean | null;
  show_in_best_sellers: boolean | null;
  show_in_new_arrivals: boolean | null;
  show_in_promotions: boolean | null;
  section_priority: number | null;
  sort_order: number | null;
  sku: string | null;
  tags: string[] | null;
  level: string | null;
  low_stock_threshold: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductImageRow {
  id: string;
  product_id: string;
  url: string;
  sort_order: number | null;
  is_primary: boolean | null;
  created_at: string | null;
}

export interface HeroSlideRow {
  id: string;
  position: number;
  is_active: boolean;
  media_type: string;
  media_url: string | null;
  poster_url: string | null;
  duration_ms: number;
  transition: string;
  title_fr: string | null;
  title_ar: string | null;
  subtitle_fr: string | null;
  subtitle_ar: string | null;
  cta_label_fr: string | null;
  cta_label_ar: string | null;
  cta_url: string | null;
  text_panel: Json;
  zone: 'main' | 'side_1' | 'side_2' | 'side_3';
  created_at: string | null;
  updated_at: string | null;
}

export interface BannerRow {
  id: string;
  title_fr: string | null;
  subtitle_fr: string | null;
  cta_fr: string | null;
  image: string | null;
  desktop_image: string | null;
  mobile_image: string | null;
  link: string | null;
  link_mode: string | null;
  link_target_id: string | null;
  banner_type: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  priority: number | null;
  start_at: string | null;
  end_at: string | null;
}

export interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  customer_wilaya: string | null;
  subtotal: number | null;
  shipping: number | null;
  discount: number | null;
  total: number | null;
  payment_method: string | null;
  delivery_type: string | null;
  status: string | null;
  notes: string | null;
  admin_note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type OrderInsert = Omit<OrderRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string | null;
  variant_id: string | null;
  quantity: number | null;
  price: number | null;
}

export type OrderItemInsert = Omit<OrderItemRow, 'id'> & { id?: string };

export interface StoreSettingRow {
  key: string;
  value: Json;
}

/**
 * Minimal Database shape for `createClient<Database>`. Only public tables that
 * the mobile app reads or writes are included.
 */
export interface Database {
  public: {
    Tables: {
      categories: { Row: CategoryRow; Insert: Partial<CategoryRow>; Update: Partial<CategoryRow> };
      products: { Row: ProductRow; Insert: Partial<ProductRow>; Update: Partial<ProductRow> };
      product_images: {
        Row: ProductImageRow;
        Insert: Partial<ProductImageRow>;
        Update: Partial<ProductImageRow>;
      };
      hero_slides: {
        Row: HeroSlideRow;
        Insert: Partial<HeroSlideRow>;
        Update: Partial<HeroSlideRow>;
      };
      banners: { Row: BannerRow; Insert: Partial<BannerRow>; Update: Partial<BannerRow> };
      orders: { Row: OrderRow; Insert: OrderInsert; Update: Partial<OrderRow> };
      order_items: {
        Row: OrderItemRow;
        Insert: OrderItemInsert;
        Update: Partial<OrderItemRow>;
      };
      store_settings: {
        Row: StoreSettingRow;
        Insert: StoreSettingRow;
        Update: Partial<StoreSettingRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/**
 * Convenience: a product enriched with its images, ready for the UI.
 */
export interface ProductWithImages extends ProductRow {
  images: ProductImageRow[];
  primaryImage: string | null;
}
