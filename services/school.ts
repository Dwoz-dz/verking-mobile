/**
 * School / Mode Étudiant service — Phase 9.
 *
 * Reads:
 *   ▸ mobile_school_levels  (anon SELECT, filter is_active = true)
 *   ▸ mobile_class_packs    (anon SELECT, filter is_active + window)
 *
 * Writes (per-device profile):
 *   ▸ school_save_my_profile, school_get_my_profile, school_clear_my_profile
 *     — SECURITY DEFINER RPCs scoped to the device_id.
 *
 * Local cache for the profile so the level pill renders instantly on
 * cold starts; the canonical truth is the DB (sync on focus + on save).
 */
import { useEffect, useState } from 'react';

import type { AddToCartInput } from '@/lib/cart';
import { getDeviceId } from '@/lib/deviceId';
import { subscribeRealtime } from '@/lib/realtime/realtimeHub';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { safeStorage } from '@/lib/storage';
import { supabase } from '@/lib/supabase/client';
import { listProductsByIds } from '@/services/products';

export type SchoolCycle = 'primaire' | 'moyen' | 'secondaire';
export type ClassPackCycle = SchoolCycle | 'all';

export interface SchoolLevel {
  level_key: string;
  cycle: SchoolCycle;
  name_fr: string;
  name_ar: string;
  short_label_fr: string;
  short_label_ar: string;
  age_min: number | null;
  age_max: number | null;
  emoji: string | null;
  accent_color: string;
  sort_order: number;
}

export interface ClassPack {
  id: string;
  slug: string;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string | null;
  subtitle_ar: string | null;
  description_fr: string | null;
  description_ar: string | null;
  cycle: ClassPackCycle | null;
  level_keys: string[];
  cover_image_url: string | null;
  badge_emoji: string | null;
  accent_color: string;
  product_ids: string[];
  bundle_discount_percent: number;
  bonus_coupon_id: string | null;
  stock: number | null;
  starts_at: string | null;
  ends_at: string | null;
  display_priority: number;
  is_featured: boolean;
}

export interface SchoolProfile {
  device_id: string;
  level_key: string;
  cycle: SchoolCycle;
  student_name: string | null;
  parent_name: string | null;
  school_name: string | null;
  relationship: 'self' | 'parent' | 'sibling' | 'other' | null;
  preferred_lang: 'fr' | 'ar' | 'en' | null;
  set_at: string;
}

const PROFILE_CACHE_KEY = 'verking.school_profile.v1';

// ─── Catalogue reads ───────────────────────────────────────────────────

export async function getSchoolLevels(): Promise<SchoolLevel[]> {
  const { data, error } = await supabase
    .from('mobile_school_levels')
    .select('level_key,cycle,name_fr,name_ar,short_label_fr,short_label_ar,age_min,age_max,emoji,accent_color,sort_order')
    .order('sort_order', { ascending: true });
  if (error) {
    console.warn('[school] levels fetch failed:', error);
    return [];
  }
  return ((data ?? []) as unknown) as SchoolLevel[];
}

export async function getClassPacks(): Promise<ClassPack[]> {
  const { data, error } = await supabase
    .from('mobile_class_packs')
    .select('id,slug,title_fr,title_ar,subtitle_fr,subtitle_ar,description_fr,description_ar,cycle,level_keys,cover_image_url,badge_emoji,accent_color,product_ids,bundle_discount_percent,bonus_coupon_id,stock,starts_at,ends_at,display_priority,is_featured')
    .order('display_priority', { ascending: false })
    .order('sort_order', { ascending: true });
  if (error) {
    console.warn('[school] packs fetch failed:', error);
    return [];
  }
  return ((data ?? []) as unknown) as ClassPack[];
}

export async function getClassPackBySlug(slug: string): Promise<ClassPack | null> {
  const { data, error } = await supabase
    .from('mobile_class_packs')
    .select('id,slug,title_fr,title_ar,subtitle_fr,subtitle_ar,description_fr,description_ar,cycle,level_keys,cover_image_url,badge_emoji,accent_color,product_ids,bundle_discount_percent,bonus_coupon_id,stock,starts_at,ends_at,display_priority,is_featured')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.warn('[school] pack-by-slug fetch failed:', error);
    return null;
  }
  return data ? (((data as unknown) as ClassPack)) : null;
}

// ─── Profile mutations via RPC ──────────────────────────────────────────

export interface SaveProfileInput {
  level_key: string;
  student_name?: string | null;
  parent_name?: string | null;
  school_name?: string | null;
  relationship?: 'self' | 'parent' | 'sibling' | 'other' | null;
  preferred_lang?: 'fr' | 'ar' | 'en' | null;
}

export async function saveSchoolProfile(input: SaveProfileInput): Promise<SchoolProfile | null> {
  const deviceId = await getDeviceId();
  const { data, error } = await supabase.rpc('school_save_my_profile', {
    p_device_id: deviceId,
    p_level_key: input.level_key,
    p_student_name: input.student_name ?? null,
    p_parent_name: input.parent_name ?? null,
    p_school_name: input.school_name ?? null,
    p_relationship: input.relationship ?? null,
    p_preferred_lang: input.preferred_lang ?? null,
  });
  if (error) {
    console.warn('[school] save profile failed:', error);
    return null;
  }
  // Re-fetch the full row (RPC returns a partial summary)
  const fresh = await getMySchoolProfile();
  if (fresh) await safeStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(fresh));
  void data;
  return fresh;
}

export async function getMySchoolProfile(): Promise<SchoolProfile | null> {
  const deviceId = await getDeviceId();
  const { data, error } = await supabase.rpc('school_get_my_profile', {
    p_device_id: deviceId,
  });
  if (error) {
    console.warn('[school] get profile failed:', error);
    return null;
  }
  if (!data) return null;
  return (data as unknown) as SchoolProfile;
}

export async function clearMySchoolProfile(): Promise<void> {
  const deviceId = await getDeviceId();
  await supabase.rpc('school_clear_my_profile', { p_device_id: deviceId });
  await safeStorage.removeItem(PROFILE_CACHE_KEY);
}

// ─── React hooks ───────────────────────────────────────────────────────

export function useSchoolLevels(): SchoolLevel[] {
  const [list, setList] = useState<SchoolLevel[]>([]);
  const globalTick = useRefreshTick();
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const data = await getSchoolLevels();
      if (!cancelled) setList(data);
    };
    void refresh();
    const unsub = subscribeRealtime('mobile_school_levels', undefined, () => { void refresh(); });
    return () => { cancelled = true; unsub(); };
  }, [globalTick]);
  return list;
}

export function useClassPacks(): ClassPack[] {
  const [list, setList] = useState<ClassPack[]>([]);
  const globalTick = useRefreshTick();
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const data = await getClassPacks();
      if (!cancelled) setList(data);
    };
    void refresh();
    const unsub = subscribeRealtime('mobile_class_packs', undefined, () => { void refresh(); });
    return () => { cancelled = true; unsub(); };
  }, [globalTick]);
  return list;
}

export function useSchoolProfile(): { profile: SchoolProfile | null; reload: () => void; loading: boolean } {
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Seed from cache for instant render
      try {
        const cached = await safeStorage.getItem(PROFILE_CACHE_KEY);
        if (cached && !cancelled) setProfile(JSON.parse(cached));
      } catch { /* noop */ }
      const fresh = await getMySchoolProfile();
      if (cancelled) return;
      setProfile(fresh);
      setLoading(false);
      if (fresh) await safeStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(fresh));
      else await safeStorage.removeItem(PROFILE_CACHE_KEY);
    })();
    return () => { cancelled = true; };
  }, [tick, globalTick]);

  return { profile, reload: () => setTick((t) => t + 1), loading };
}

// ─── Pack → cart helper ────────────────────────────────────────────────

export interface PackAddResult {
  added_count: number;
  /** Sum of unit_price × qty for the products that were resolved + added. */
  pack_subtotal: number;
  /** Computed savings = pack_subtotal × bundle_discount_percent / 100. */
  estimated_savings: number;
  /** Products that didn't resolve (stale UUID or inactive). */
  missing_ids: string[];
}

/**
 * Resolve a pack's `product_ids[]` into live products and stamp every
 * line with pack metadata so the cart can compute the bundle saving.
 *
 * `add` is the cart action from `useCartActions()` — the helper stays
 * UI-framework-agnostic by accepting it as a parameter rather than
 * importing the React context.
 */
export async function addPackToCart(
  pack: ClassPack,
  addLine: (input: AddToCartInput) => void,
): Promise<PackAddResult> {
  if (!pack.product_ids || pack.product_ids.length === 0) {
    return { added_count: 0, pack_subtotal: 0, estimated_savings: 0, missing_ids: [] };
  }

  const products = await listProductsByIds(pack.product_ids);
  const found = new Set(products.map((p) => p.id));
  const missing = pack.product_ids.filter((id) => !found.has(id));

  let subtotal = 0;
  let added = 0;
  for (const p of products) {
    const unitPrice = p.price ?? 0;
    if (unitPrice <= 0) continue; // skip products without a defined price
    addLine({
      product_id: p.id,
      mode: 'detail',
      qty: 1,
      unit_price: unitPrice,
      name_fr: p.name_fr,
      name_ar: p.name_ar ?? p.name_fr,
      image: p.primaryImage ?? null,
      pack_id: pack.id,
      pack_slug: pack.slug,
      pack_title: pack.title_fr,
      pack_discount_pct: pack.bundle_discount_percent,
      pack_accent_color: pack.accent_color,
    });
    subtotal += unitPrice;
    added += 1;
  }

  return {
    added_count: added,
    pack_subtotal: subtotal,
    estimated_savings: Math.round((subtotal * pack.bundle_discount_percent) / 100),
    missing_ids: missing,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────

export function groupByCycle(levels: SchoolLevel[]): Record<SchoolCycle, SchoolLevel[]> {
  const out: Record<SchoolCycle, SchoolLevel[]> = { primaire: [], moyen: [], secondaire: [] };
  for (const l of levels) out[l.cycle].push(l);
  for (const k of Object.keys(out) as SchoolCycle[]) out[k].sort((a, b) => a.sort_order - b.sort_order);
  return out;
}

export const CYCLE_LABEL_FR: Record<SchoolCycle, string> = {
  primaire: 'Cycle Primaire',
  moyen: 'Cycle Moyen',
  secondaire: 'Cycle Secondaire',
};
export const CYCLE_LABEL_AR: Record<SchoolCycle, string> = {
  primaire: 'الطور الابتدائي',
  moyen: 'الطور المتوسط',
  secondaire: 'الطور الثانوي',
};
