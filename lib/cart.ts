/**
 * VERKING cart — pure state, types and persistence.
 *
 * The cart is the single source of truth for the user's intent before
 * checkout. We keep it intentionally lightweight:
 *
 *  ▸ Each line is a *snapshot* of the product at the moment of add — name,
 *    image, price, mode. So if the admin updates the price mid-session,
 *    the user still sees what they signed up for. The server re-validates
 *    on order placement, so we will never undercharge.
 *  ▸ Lines are keyed by `${product_id}:${mode}` so the same product in
 *    Détail vs Gros are distinct lines (different price tiers + min qty).
 *  ▸ Persistence: `safeStorage` wrapper (AsyncStorage with in-memory
 *    fallback). Cart survives app restarts on properly-built dev clients
 *    and stays in-memory only when AsyncStorage is unavailable.
 *  ▸ Versioned key (`STORAGE_KEY`) so we can ship breaking changes
 *    without leaving stale data in user storages.
 *
 * The provider/hooks layer (`components/cart/CartProvider.tsx`) wraps
 * these primitives in React Context. UI code never imports from here
 * directly — it goes through `useCart()` / `useCartActions()`.
 */
import { safeStorage } from '@/lib/storage';
import type { SaleMode } from '@/services/orders';

/** Persistence key — bump the suffix on breaking schema changes. */
export const CART_STORAGE_KEY = 'verking:cart:v1';

/** Hard cap on quantity per line — protects against runaway steppers. */
export const CART_MAX_QTY_PER_LINE = 999;

/**
 * One product entry in the cart. Captured at "add to cart" time so the
 * line stays stable even if the underlying product is later edited or
 * goes out of stock.
 */
export interface CartLine {
  /** `${product_id}:${mode}` — also the React key. */
  id: string;
  product_id: string;
  mode: SaleMode;
  /** Snapshot at add time — Détail unit price (or Gros tier price). */
  unit_price: number;
  /** Display name snapshot (we pick the locale-appropriate name in UI). */
  name_fr: string;
  name_ar: string | null;
  name_en: string | null;
  /** Cover image URI snapshot, may be null when product has no media. */
  image: string | null;
  /** Optional category snapshot for the cart row. */
  category_label_fr: string | null;
  /** 1..CART_MAX_QTY_PER_LINE */
  qty: number;
  /** Min order qty for the chosen tier (Gros). 1 in Détail. */
  min_qty: number;
  /** Stock cap — UI uses this to disable + when reached. null = unknown. */
  stock_cap: number | null;
  /** Epoch ms — useful for "Recently added to cart" sort + analytics. */
  added_at: number;
  /** Epoch ms — last time this line was touched. */
  updated_at: number;
  /** Phase 9.5 — bundle metadata when the line was added as part of a Class Pack. */
  pack_id?: string | null;
  pack_slug?: string | null;
  pack_title?: string | null;
  pack_discount_pct?: number | null;
  pack_accent_color?: string | null;
}

export interface CartState {
  lines: CartLine[];
  /** True once the persisted cart has been read at boot. */
  hydrated: boolean;
}

export const EMPTY_CART: CartState = { lines: [], hydrated: false };

// ─── Actions ────────────────────────────────────────────────────────────

/** Args required to add a product to cart. */
export interface AddToCartInput {
  product_id: string;
  mode: SaleMode;
  unit_price: number;
  name_fr: string;
  name_ar?: string | null;
  name_en?: string | null;
  image?: string | null;
  category_label_fr?: string | null;
  qty?: number;
  min_qty?: number;
  stock_cap?: number | null;
  /** Phase 9.5 — when this product is being added as part of a Class Pack. */
  pack_id?: string | null;
  pack_slug?: string | null;
  pack_title?: string | null;
  pack_discount_pct?: number | null;
  pack_accent_color?: string | null;
}

export type CartAction =
  | { type: 'hydrate'; lines: CartLine[] }
  | { type: 'add'; input: AddToCartInput }
  | { type: 'set_qty'; line_id: string; qty: number }
  | { type: 'remove'; line_id: string }
  | { type: 'clear' };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'hydrate':
      return { lines: action.lines, hydrated: true };

    case 'add': {
      const { input } = action;
      const id = `${input.product_id}:${input.mode}`;
      const requestedQty = Math.max(1, Math.floor(input.qty ?? 1));
      const minQty = Math.max(1, Math.floor(input.min_qty ?? 1));
      const cap = input.stock_cap ?? null;
      const now = Date.now();
      const existing = state.lines.find((l) => l.id === id);

      if (existing) {
        const next = clampQty(existing.qty + requestedQty, minQty, cap);
        if (next === existing.qty) return state;
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.id === id ? { ...l, qty: next, updated_at: now } : l,
          ),
        };
      }

      const startingQty = clampQty(Math.max(requestedQty, minQty), minQty, cap);
      const newLine: CartLine = {
        id,
        product_id: input.product_id,
        mode: input.mode,
        unit_price: input.unit_price,
        name_fr: input.name_fr,
        name_ar: input.name_ar ?? null,
        name_en: input.name_en ?? null,
        image: input.image ?? null,
        category_label_fr: input.category_label_fr ?? null,
        qty: startingQty,
        min_qty: minQty,
        stock_cap: cap,
        added_at: now,
        updated_at: now,
        pack_id: input.pack_id ?? null,
        pack_slug: input.pack_slug ?? null,
        pack_title: input.pack_title ?? null,
        pack_discount_pct: input.pack_discount_pct ?? null,
        pack_accent_color: input.pack_accent_color ?? null,
      };
      return { ...state, lines: [newLine, ...state.lines] };
    }

    case 'set_qty': {
      const target = state.lines.find((l) => l.id === action.line_id);
      if (!target) return state;
      const next = clampQty(action.qty, target.min_qty, target.stock_cap);
      if (next === target.qty) return state;
      if (next === 0) {
        return { ...state, lines: state.lines.filter((l) => l.id !== action.line_id) };
      }
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.id === action.line_id ? { ...l, qty: next, updated_at: Date.now() } : l,
        ),
      };
    }

    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.id !== action.line_id) };

    case 'clear':
      return { ...state, lines: [] };
  }
}

/**
 * Clamp a desired quantity to the line's allowed range.
 * - Anything below `min_qty` collapses to 0 (which removes the line).
 * - `stock_cap === null` means unknown stock — we trust the UI's request
 *   but still cap at CART_MAX_QTY_PER_LINE.
 */
function clampQty(desired: number, minQty: number, stockCap: number | null): number {
  const floored = Math.floor(desired);
  if (!Number.isFinite(floored) || floored < minQty) return 0;
  const upper = stockCap === null ? CART_MAX_QTY_PER_LINE : Math.min(stockCap, CART_MAX_QTY_PER_LINE);
  return Math.min(floored, upper);
}

// ─── Selectors ──────────────────────────────────────────────────────────

/**
 * One bundle present in the cart, with its computed savings. Used by
 * the cart summary to render a "Pack X — remise -Y%" line.
 */
export interface CartBundleSummary {
  pack_id: string;
  pack_slug: string | null;
  pack_title: string | null;
  pack_discount_pct: number;
  pack_accent_color: string | null;
  /** Sum of (unit_price * qty) for the lines belonging to this pack. */
  pack_subtotal: number;
  /** Money the user saves: pack_subtotal * pack_discount_pct / 100. */
  savings: number;
  /** How many distinct lines belong to this pack (info for the UI). */
  line_count: number;
}

export interface CartTotals {
  /** Sum of all line `qty * unit_price` (BEFORE bundle discount). */
  subtotal: number;
  /** Distinct line count. */
  line_count: number;
  /** Sum of all `qty` across lines (used for badge counts). */
  unit_count: number;
  /** True if the cart contains both Gros and Détail lines (mixed-mode). */
  is_mixed_mode: boolean;
  /** Phase 9.5 — bundles present in the cart, one entry per distinct pack. */
  bundles: CartBundleSummary[];
  /** Sum of all bundle savings (already deducted from a "post-bundle" subtotal). */
  bundle_savings: number;
  /** subtotal - bundle_savings — the figure that goes into shipping + checkout math. */
  subtotal_after_bundle: number;
}

export function getTotals(state: CartState): CartTotals {
  let subtotal = 0;
  let unitCount = 0;
  let hasGros = false;
  let hasDetail = false;
  // Group pack lines by pack_id for bundle math.
  const packs = new Map<string, CartBundleSummary>();
  for (const l of state.lines) {
    const lineTotal = l.unit_price * l.qty;
    subtotal += lineTotal;
    unitCount += l.qty;
    if (l.mode === 'gros') hasGros = true;
    else hasDetail = true;

    if (l.pack_id && typeof l.pack_discount_pct === 'number' && l.pack_discount_pct > 0) {
      const existing = packs.get(l.pack_id);
      if (existing) {
        existing.pack_subtotal += lineTotal;
        existing.line_count += 1;
      } else {
        packs.set(l.pack_id, {
          pack_id: l.pack_id,
          pack_slug: l.pack_slug ?? null,
          pack_title: l.pack_title ?? null,
          pack_discount_pct: l.pack_discount_pct,
          pack_accent_color: l.pack_accent_color ?? null,
          pack_subtotal: lineTotal,
          savings: 0,
          line_count: 1,
        });
      }
    }
  }
  // Compute per-bundle savings, rounded to the nearest DA — we never give
  // back fractional dinars in the displayed total.
  let bundleSavings = 0;
  const bundles: CartBundleSummary[] = [];
  for (const b of packs.values()) {
    b.savings = Math.round((b.pack_subtotal * b.pack_discount_pct) / 100);
    bundleSavings += b.savings;
    bundles.push(b);
  }
  return {
    subtotal,
    line_count: state.lines.length,
    unit_count: unitCount,
    is_mixed_mode: hasGros && hasDetail,
    bundles,
    bundle_savings: bundleSavings,
    subtotal_after_bundle: Math.max(0, subtotal - bundleSavings),
  };
}

// ─── Persistence ────────────────────────────────────────────────────────

/**
 * Serialise the cart for storage. Only the lines array — the `hydrated`
 * flag is in-memory only and always re-set to true on read.
 */
function serialise(state: CartState): string {
  return JSON.stringify({ v: 1, lines: state.lines });
}

/**
 * Defensive deserialisation — anything malformed yields an empty cart.
 * We accept a slightly looser shape so old cart entries from a previous
 * release can still hydrate (best-effort).
 */
function deserialise(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { v?: number; lines?: unknown };
    if (!parsed || !Array.isArray(parsed.lines)) return [];
    const out: CartLine[] = [];
    for (const item of parsed.lines as unknown[]) {
      const line = sanitiseLine(item);
      if (line) out.push(line);
    }
    return out;
  } catch {
    return [];
  }
}

function sanitiseLine(raw: unknown): CartLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const product_id = typeof r.product_id === 'string' ? r.product_id : null;
  const mode = r.mode === 'gros' || r.mode === 'detail' ? (r.mode as SaleMode) : null;
  if (!product_id || !mode) return null;
  const unit_price = typeof r.unit_price === 'number' && r.unit_price >= 0 ? r.unit_price : 0;
  const qty = typeof r.qty === 'number' && r.qty >= 1 ? Math.floor(r.qty) : 1;
  const min_qty = typeof r.min_qty === 'number' && r.min_qty >= 1 ? Math.floor(r.min_qty) : 1;
  const stock_cap =
    typeof r.stock_cap === 'number' && r.stock_cap >= 0 ? Math.floor(r.stock_cap) : null;
  const packDiscount =
    typeof r.pack_discount_pct === 'number' && r.pack_discount_pct >= 0 && r.pack_discount_pct <= 100
      ? r.pack_discount_pct
      : null;
  return {
    id: `${product_id}:${mode}`,
    product_id,
    mode,
    unit_price,
    name_fr: typeof r.name_fr === 'string' ? r.name_fr : '',
    name_ar: typeof r.name_ar === 'string' ? r.name_ar : null,
    name_en: typeof r.name_en === 'string' ? r.name_en : null,
    image: typeof r.image === 'string' ? r.image : null,
    category_label_fr: typeof r.category_label_fr === 'string' ? r.category_label_fr : null,
    qty: Math.min(qty, CART_MAX_QTY_PER_LINE),
    min_qty,
    stock_cap,
    added_at: typeof r.added_at === 'number' ? r.added_at : Date.now(),
    updated_at: typeof r.updated_at === 'number' ? r.updated_at : Date.now(),
    pack_id: typeof r.pack_id === 'string' && r.pack_id ? r.pack_id : null,
    pack_slug: typeof r.pack_slug === 'string' && r.pack_slug ? r.pack_slug : null,
    pack_title: typeof r.pack_title === 'string' && r.pack_title ? r.pack_title : null,
    pack_discount_pct: packDiscount,
    pack_accent_color: typeof r.pack_accent_color === 'string' ? r.pack_accent_color : null,
  };
}

export async function loadCartFromStorage(): Promise<CartLine[]> {
  try {
    const raw = await safeStorage.getItem(CART_STORAGE_KEY);
    return deserialise(raw);
  } catch (err) {
    console.warn('[cart] hydrate failed:', err);
    return [];
  }
}

export async function saveCartToStorage(state: CartState): Promise<void> {
  try {
    await safeStorage.setItem(CART_STORAGE_KEY, serialise(state));
  } catch (err) {
    console.warn('[cart] persist failed:', err);
  }
}

export async function clearCartStorage(): Promise<void> {
  try {
    await safeStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    /* noop */
  }
}
