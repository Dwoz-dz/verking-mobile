/**
 * Mobile remote config — single source for the Gestionnaire-driven
 * theme, cart settings, and Home sections.
 *
 * All three live in dedicated tables (`mobile_theme`,
 * `mobile_cart_settings`, `mobile_home_sections`) with RLS allowing
 * anon SELECT. We fetch once per app boot (and on focus) with a 60s
 * in-memory cache so screens that read these values never wait twice.
 *
 * Read API:
 *   getMobileTheme()       → ThemeConfig (with safe defaults baked in)
 *   getMobileCartConfig()  → CartConfig  (with safe defaults baked in)
 *   getMobileHomeSections()→ ordered, enabled-only list of sections
 *
 * The mobile UI consumes these via lightweight React hooks (see
 * `useMobileCartConfig` etc.) that subscribe to the cache so changes
 * propagate immediately when we trigger a refresh.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase/client';
import { safeStorage } from '@/lib/storage';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ThemeConfig {
  primary_color: string;
  cta_color: string;
  background_color: string;
  card_radius: number;
  badges_style: 'pill' | 'rounded' | 'square';
  glass_mode: boolean;
  // Phase 12 — premium background + tab bar style
  background_image_url: string | null;
  background_video_url: string | null;
  overlay_opacity: number;          // 0..100
  blur_amount: number;              // 0..20
  tab_bar_style: 'floating' | 'flat' | 'minimal';
}

export interface TrustSignalConfig {
  key: string;
  enabled: boolean;
  icon?: string;
  /** Optional uploaded image URL — overrides `icon` when set. */
  icon_url?: string | null;
  label_fr: string;
  label_ar: string;
}

export interface CartConfig {
  min_order: number;
  free_delivery_threshold: number | null;
  default_delivery_price: number;
  whatsapp_enabled: boolean;
  cod_enabled: boolean;
  checkout_mode: 'whatsapp' | 'app' | 'both';
  trust_signals: TrustSignalConfig[];
  // Phase 13 — admin-driven support channels (read by services/contact.ts)
  support_phone: string | null;
  support_email: string | null;
  support_whatsapp: string | null;
}

const DEFAULT_TRUST_SIGNALS: TrustSignalConfig[] = [
  { key: 'shipping', enabled: true, icon: 'rocket-outline',          label_fr: 'Livraison Yalidine / ZR Express', label_ar: 'التوصيل عبر ياليدين / ZR' },
  { key: 'cod',      enabled: true, icon: 'cash-outline',            label_fr: 'Paiement à la livraison',          label_ar: 'الدفع عند الاستلام' },
  { key: 'whatsapp', enabled: true, icon: 'logo-whatsapp',           label_fr: 'Support WhatsApp 24/7',            label_ar: 'دعم واتساب 24/7' },
  { key: 'warranty', enabled: true, icon: 'shield-checkmark-outline',label_fr: 'Garantie 7 jours',                 label_ar: 'ضمان 7 أيام' },
];

export interface HomeSection {
  section_key: string;
  is_enabled: boolean;
  sort_order: number;
  config: Record<string, unknown>;
}

// ─── Defaults — used when the row is empty or fetch fails ───────────────

export const DEFAULT_THEME: ThemeConfig = {
  primary_color: '#2D7DD2',
  cta_color: '#FF7A1A',
  background_color: '#F9F9FC',
  card_radius: 20,
  badges_style: 'pill',
  glass_mode: true,
  // Phase 12 — premium background defaults (no asset = solid colour)
  background_image_url: null,
  background_video_url: null,
  overlay_opacity: 40,
  blur_amount: 8,
  tab_bar_style: 'floating',
};

export const DEFAULT_CART_CONFIG: CartConfig = {
  min_order: 0,
  free_delivery_threshold: null,
  default_delivery_price: 0,
  whatsapp_enabled: true,
  cod_enabled: true,
  checkout_mode: 'both',
  trust_signals: DEFAULT_TRUST_SIGNALS,
  support_phone: null,
  support_email: null,
  support_whatsapp: null,
};

/** Trim & coerce a JSON value to a non-empty string, or null. */
function pickText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function normaliseTrustSignals(raw: unknown): TrustSignalConfig[] {
  if (!Array.isArray(raw)) return DEFAULT_TRUST_SIGNALS;
  const out: TrustSignalConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const key = typeof r.key === 'string' ? r.key.trim() : '';
    const label_fr = typeof r.label_fr === 'string' ? r.label_fr : '';
    const label_ar = typeof r.label_ar === 'string' ? r.label_ar : label_fr;
    if (!key || !label_fr) continue;
    const icon_url = typeof r.icon_url === 'string' && r.icon_url.trim().length > 0
      ? r.icon_url.trim()
      : null;
    out.push({
      key,
      enabled: r.enabled === false ? false : true,
      icon: typeof r.icon === 'string' && r.icon.trim() ? r.icon.trim() : undefined,
      icon_url,
      label_fr,
      label_ar,
    });
  }
  return out.length > 0 ? out : DEFAULT_TRUST_SIGNALS;
}

export const DEFAULT_HOME_SECTIONS: HomeSection[] = [];

// ─── Cache ──────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expires_at: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || entry.expires_at < Date.now()) return null;
  return entry.value as T;
}

function setCached<T>(key: string, value: T): void {
  cache.set(key, { value, expires_at: Date.now() + CACHE_TTL_MS });
}

/**
 * Invalidate a single cache scope (e.g. 'theme', 'cart', 'home_sections',
 * 'wilayas') and re-run all hook subscribers. Hooks bound to other
 * scopes will hit their warm cache on re-fetch and bail out without a
 * network round-trip — only the invalidated scope actually re-fetches.
 *
 * Pass no argument (or undefined) to clear EVERY scope, the way the
 * original cache-clear behaviour worked.
 */
export function invalidateMobileConfigScope(scope?: string): void {
  if (scope) {
    cache.delete(scope);
  } else {
    cache.clear();
  }
  for (const fn of subscribers) {
    try { fn(); } catch { /* noop */ }
  }
}

/** Force-clear ALL caches — call after pull-to-refresh or app focus. */
export function invalidateMobileConfigCache(): void {
  invalidateMobileConfigScope();
}

// Pub/sub for hook re-fetches.
const subscribers = new Set<() => void>();
function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// ─── Reads ──────────────────────────────────────────────────────────────

export async function getMobileTheme(): Promise<ThemeConfig> {
  const cached = getCached<ThemeConfig>('theme');
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('mobile_theme')
      .select('primary_color,cta_color,background_color,card_radius,badges_style,glass_mode,background_image_url,background_video_url,overlay_opacity,blur_amount,tab_bar_style')
      .eq('id', 'default')
      .maybeSingle();
    if (error) throw error;
    const tabStyleRaw = (data?.tab_bar_style as string) ?? null;
    const tab_bar_style: ThemeConfig['tab_bar_style'] =
      tabStyleRaw === 'flat' || tabStyleRaw === 'minimal' ? tabStyleRaw : 'floating';
    const merged: ThemeConfig = {
      primary_color: (data?.primary_color as string) || DEFAULT_THEME.primary_color,
      cta_color: (data?.cta_color as string) || DEFAULT_THEME.cta_color,
      background_color: (data?.background_color as string) || DEFAULT_THEME.background_color,
      card_radius: (data?.card_radius as number) ?? DEFAULT_THEME.card_radius,
      badges_style: ((data?.badges_style as ThemeConfig['badges_style']) || DEFAULT_THEME.badges_style),
      glass_mode: data?.glass_mode == null ? DEFAULT_THEME.glass_mode : Boolean(data.glass_mode),
      background_image_url: typeof data?.background_image_url === 'string' && data.background_image_url.trim().length > 0
        ? data.background_image_url
        : null,
      background_video_url: typeof data?.background_video_url === 'string' && data.background_video_url.trim().length > 0
        ? data.background_video_url
        : null,
      overlay_opacity: typeof data?.overlay_opacity === 'number'
        ? Math.min(100, Math.max(0, data.overlay_opacity))
        : DEFAULT_THEME.overlay_opacity,
      blur_amount: typeof data?.blur_amount === 'number'
        ? Math.min(20, Math.max(0, data.blur_amount))
        : DEFAULT_THEME.blur_amount,
      tab_bar_style,
    };
    setCached('theme', merged);
    return merged;
  } catch (err) {
    console.warn('[mobileConfig] theme fetch failed, using defaults:', err);
    return DEFAULT_THEME;
  }
}

export async function getMobileCartConfig(): Promise<CartConfig> {
  const cached = getCached<CartConfig>('cart');
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('mobile_cart_settings')
      .select('min_order,free_delivery_threshold,default_delivery_price,whatsapp_enabled,cod_enabled,checkout_mode,trust_signals,support_phone,support_email,support_whatsapp')
      .eq('id', 'default')
      .maybeSingle();
    if (error) throw error;
    const merged: CartConfig = {
      min_order: typeof data?.min_order === 'number' ? data.min_order : DEFAULT_CART_CONFIG.min_order,
      free_delivery_threshold:
        typeof data?.free_delivery_threshold === 'number' ? data.free_delivery_threshold : null,
      default_delivery_price:
        typeof data?.default_delivery_price === 'number'
          ? data.default_delivery_price
          : DEFAULT_CART_CONFIG.default_delivery_price,
      whatsapp_enabled: data?.whatsapp_enabled == null ? true : Boolean(data.whatsapp_enabled),
      cod_enabled: data?.cod_enabled == null ? true : Boolean(data.cod_enabled),
      checkout_mode:
        (data?.checkout_mode as CartConfig['checkout_mode']) || DEFAULT_CART_CONFIG.checkout_mode,
      trust_signals: normaliseTrustSignals((data as Record<string, unknown> | null)?.trust_signals),
      support_phone:    pickText(data?.support_phone),
      support_email:    pickText(data?.support_email),
      support_whatsapp: pickText(data?.support_whatsapp),
    };
    setCached('cart', merged);
    return merged;
  } catch (err) {
    console.warn('[mobileConfig] cart fetch failed, using defaults:', err);
    return DEFAULT_CART_CONFIG;
  }
}

export async function getMobileHomeSections(): Promise<HomeSection[]> {
  const cached = getCached<HomeSection[]>('home_sections');
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('mobile_home_sections')
      .select('section_key,is_enabled,sort_order,config')
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    const list: HomeSection[] = (data ?? []).map((row: Record<string, unknown>) => ({
      section_key: String(row.section_key ?? ''),
      is_enabled: Boolean(row.is_enabled),
      sort_order: Number(row.sort_order ?? 0),
      config: (row.config as Record<string, unknown>) ?? {},
    }));
    setCached('home_sections', list);
    return list;
  } catch (err) {
    console.warn('[mobileConfig] home_sections fetch failed:', err);
    return DEFAULT_HOME_SECTIONS;
  }
}

// ─── React hooks ────────────────────────────────────────────────────────

/**
 * Hook returning the latest cart config. Auto-refreshes when
 * `invalidateMobileConfigCache()` fires.
 */
export function useMobileCartConfig(): CartConfig {
  const [value, setValue] = useState<CartConfig>(DEFAULT_CART_CONFIG);
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      const next = await getMobileCartConfig();
      if (!cancelled) setValue(next);
    };
    void fetchOnce();
    const unsub = subscribe(fetchOnce);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return value;
}

export function useMobileTheme(): ThemeConfig {
  const [value, setValue] = useState<ThemeConfig>(DEFAULT_THEME);
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      const next = await getMobileTheme();
      if (!cancelled) setValue(next);
    };
    void fetchOnce();
    const unsub = subscribe(fetchOnce);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return value;
}

export function useMobileHomeSections(): HomeSection[] {
  const [value, setValue] = useState<HomeSection[]>(DEFAULT_HOME_SECTIONS);
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      const next = await getMobileHomeSections();
      if (!cancelled) setValue(next);
    };
    void fetchOnce();
    const unsub = subscribe(fetchOnce);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return value;
}

// ─── Wilayas (Phase 0 — reference data, read-only) ──────────────────────

export type WilayaRegion = 'centre' | 'est' | 'ouest' | 'sud';

export interface WilayaRow {
  code: string;          // '01' .. '58'
  name_fr: string;
  name_ar: string;
  region: WilayaRegion;
  sort_order: number;
}

export const DEFAULT_WILAYAS: WilayaRow[] = [];

export async function getWilayas(): Promise<WilayaRow[]> {
  const cached = getCached<WilayaRow[]>('wilayas');
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('wilayas')
      .select('code,name_fr,name_ar,region,sort_order')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    const list = ((data ?? []) as unknown) as WilayaRow[];
    setCached('wilayas', list);
    return list;
  } catch (err) {
    console.warn('[mobileConfig] wilayas fetch failed:', err);
    return DEFAULT_WILAYAS;
  }
}

export function useWilayas(): WilayaRow[] {
  const [value, setValue] = useState<WilayaRow[]>(DEFAULT_WILAYAS);
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      const next = await getWilayas();
      if (!cancelled) setValue(next);
    };
    void fetchOnce();
    const unsub = subscribe(fetchOnce);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return value;
}

// ─── Shipping zones (Phase 1 — admin-controlled per wilaya) ─────────────

export interface ShippingZoneRow {
  wilaya_code: string;
  fee: number;
  fee_desk: number | null;
  fee_home: number | null;
  free_threshold_override: number | null;
  eta_days_min: number | null;
  eta_days_max: number | null;
  carrier_default: string;
  is_enabled: boolean;
  custom_banner_image: string | null;
  custom_banner_link: string | null;
}

export const DEFAULT_SHIPPING_ZONES: ShippingZoneRow[] = [];

export async function getShippingZones(): Promise<ShippingZoneRow[]> {
  const cached = getCached<ShippingZoneRow[]>('shipping_zones');
  if (cached) return cached;

  try {
    // RLS allows reading all rows so the admin UI can manage them; the
    // mobile app filters is_enabled itself so the picker / Home strip
    // never surface a wilaya the admin has disabled.
    const { data, error } = await supabase
      .from('mobile_shipping_zones')
      .select(
        'wilaya_code,fee,fee_desk,fee_home,free_threshold_override,' +
          'eta_days_min,eta_days_max,carrier_default,is_enabled,' +
          'custom_banner_image,custom_banner_link',
      )
      .eq('is_enabled', true);
    if (error) throw error;
    const list = ((data ?? []) as unknown) as ShippingZoneRow[];
    setCached('shipping_zones', list);
    return list;
  } catch (err) {
    console.warn('[mobileConfig] shipping_zones fetch failed:', err);
    return DEFAULT_SHIPPING_ZONES;
  }
}

export function useShippingZones(): ShippingZoneRow[] {
  const [value, setValue] = useState<ShippingZoneRow[]>(DEFAULT_SHIPPING_ZONES);
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      const next = await getShippingZones();
      if (!cancelled) setValue(next);
    };
    void fetchOnce();
    const unsub = subscribe(fetchOnce);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return value;
}

/**
 * Convenience selector: returns the zone for `code`, or null.
 * Memoised against the zones array reference so it's safe to call
 * inside lists (ProductCard ETA badge etc.).
 */
export function useShippingFor(code: string | null | undefined): ShippingZoneRow | null {
  const zones = useShippingZones();
  return useMemo(() => {
    if (!code) return null;
    for (const z of zones) {
      if (z.wilaya_code === code) return z;
    }
    return null;
  }, [zones, code]);
}

// ─── Default wilaya selection (local-only until auth lands) ─────────────

const DEFAULT_WILAYA_STORAGE_KEY = 'verking.default_wilaya_code';

/**
 * Wilaya code used when the user hasn't picked one yet. Alger keeps
 * the first launch sensible for the majority of our users; the picker
 * exists right next to the strip so changing it is one tap away.
 */
export const DEFAULT_WILAYA_FALLBACK = '16';

// Module-level singleton state — first read fans out to AsyncStorage,
// subsequent reads are O(1). Notifies all hook subscribers on change so a
// long product list doesn't pay 50 AsyncStorage reads per render.
type DefaultWilayaState =
  | { status: 'idle' }
  | { status: 'loading'; promise: Promise<string | null> }
  | { status: 'ready'; code: string | null };

let defaultWilayaState: DefaultWilayaState = { status: 'idle' };
const wilayaSubscribers = new Set<() => void>();

function notifyWilayaSubscribers(): void {
  for (const fn of wilayaSubscribers) {
    try { fn(); } catch { /* noop */ }
  }
}

async function readFromStorage(): Promise<string | null> {
  try {
    const v = await safeStorage.getItem(DEFAULT_WILAYA_STORAGE_KEY);
    if (typeof v !== 'string' || !v.trim()) return null;
    return v.trim();
  } catch {
    return null;
  }
}

export async function getDefaultWilayaCode(): Promise<string | null> {
  if (defaultWilayaState.status === 'ready') return defaultWilayaState.code;
  if (defaultWilayaState.status === 'loading') return defaultWilayaState.promise;
  const promise = readFromStorage().then((code) => {
    defaultWilayaState = { status: 'ready', code };
    return code;
  });
  defaultWilayaState = { status: 'loading', promise };
  return promise;
}

export async function setDefaultWilayaCode(code: string): Promise<void> {
  if (!code) return;
  try {
    await safeStorage.setItem(DEFAULT_WILAYA_STORAGE_KEY, code);
  } catch (err) {
    console.warn('[mobileConfig] setDefaultWilayaCode failed:', err);
  }
  defaultWilayaState = { status: 'ready', code };
  notifyWilayaSubscribers();
}

export async function clearDefaultWilayaCode(): Promise<void> {
  try {
    await safeStorage.removeItem(DEFAULT_WILAYA_STORAGE_KEY);
  } catch (err) {
    console.warn('[mobileConfig] clearDefaultWilayaCode failed:', err);
  }
  defaultWilayaState = { status: 'ready', code: null };
  notifyWilayaSubscribers();
}

/** Synchronous read for components that need a value during render
 *  before useEffect fires. Returns null until the first AsyncStorage
 *  read completes. */
export function peekDefaultWilayaCode(): string | null {
  return defaultWilayaState.status === 'ready' ? defaultWilayaState.code : null;
}

export interface UseDefaultWilayaResult {
  /** Raw stored value — null until the user picks one. */
  code: string | null;
  /** code ?? DEFAULT_WILAYA_FALLBACK — what UI should display. */
  effectiveCode: string;
  /** Resolved wilaya row (or null while wilayas list is still loading). */
  wilaya: WilayaRow | null;
  setCode: (code: string) => Promise<void>;
  clear: () => Promise<void>;
  /** True until the first AsyncStorage read completes. */
  loading: boolean;
}

export function useDefaultWilaya(): UseDefaultWilayaResult {
  // Seed synchronously from module state so components that mount AFTER
  // the first read get the value on the first render — no flash of fallback.
  const [code, setCodeState] = useState<string | null>(peekDefaultWilayaCode);
  const [loading, setLoading] = useState(
    () => defaultWilayaState.status !== 'ready',
  );
  const wilayas = useWilayas();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const next = await getDefaultWilayaCode();
      if (!cancelled) {
        setCodeState(next);
        setLoading(false);
      }
    };
    void refresh();
    wilayaSubscribers.add(refresh);
    return () => {
      cancelled = true;
      wilayaSubscribers.delete(refresh);
    };
  }, []);

  const setCode = useCallback(async (next: string) => {
    await setDefaultWilayaCode(next);
  }, []);
  const clear = useCallback(async () => {
    await clearDefaultWilayaCode();
  }, []);

  const effectiveCode = code ?? DEFAULT_WILAYA_FALLBACK;
  const wilaya = useMemo(
    () => wilayas.find((w) => w.code === effectiveCode) ?? null,
    [wilayas, effectiveCode],
  );

  return { code, effectiveCode, wilaya, setCode, clear, loading };
}
