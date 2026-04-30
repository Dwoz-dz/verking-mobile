/**
 * CartProvider — React Context wrapper around the cart reducer.
 *
 * Mounted high in the tree (in `app/_layout.tsx`) so every screen and
 * the floating Cart FAB can read state and dispatch from anywhere via
 * the typed hooks below.
 *
 * State vs. actions are split into two contexts so components that only
 * need to dispatch (e.g. an "Add to cart" button) don't re-render every
 * time the cart changes. UI counters use `useCartTotals()` which
 * memoises the totals to avoid useless re-renders.
 *
 * Persistence:
 *   ▸ On mount we read the stored cart asynchronously and dispatch
 *     `hydrate`. Until that lands, `useCartState().hydrated` is false —
 *     UI can show a placeholder if it cares (it usually doesn't because
 *     `lines` starts as []).
 *   ▸ After every state change we write-through to safeStorage.
 *     Persistence is best-effort: if it fails we just log a warning,
 *     the user can still complete their session.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';

import {
  cartReducer,
  EMPTY_CART,
  getTotals,
  loadCartFromStorage,
  saveCartToStorage,
  type AddToCartInput,
  type CartLine,
  type CartState,
  type CartTotals,
} from '@/lib/cart';

interface CartActionsAPI {
  add: (input: AddToCartInput) => void;
  setQty: (line_id: string, qty: number) => void;
  remove: (line_id: string) => void;
  clear: () => void;
}

const CartStateContext = createContext<CartState>(EMPTY_CART);
const CartActionsContext = createContext<CartActionsAPI | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, EMPTY_CART);

  // ─── Hydrate from storage on first mount ───
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const lines = await loadCartFromStorage();
      if (!cancelled) dispatch({ type: 'hydrate', lines });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Persist on change (only after hydrate, to avoid clobbering with []) ───
  useEffect(() => {
    if (!state.hydrated) return;
    void saveCartToStorage(state);
  }, [state]);

  // ─── Stable actions ───
  const actions = useMemo<CartActionsAPI>(
    () => ({
      add: (input) => dispatch({ type: 'add', input }),
      setQty: (line_id, qty) => dispatch({ type: 'set_qty', line_id, qty }),
      remove: (line_id) => dispatch({ type: 'remove', line_id }),
      clear: () => dispatch({ type: 'clear' }),
    }),
    [],
  );

  return (
    <CartStateContext.Provider value={state}>
      <CartActionsContext.Provider value={actions}>{children}</CartActionsContext.Provider>
    </CartStateContext.Provider>
  );
}

// ─── Hooks ──────────────────────────────────────────────────────────────

/** Full cart state — use sparingly to avoid wide re-renders. */
export function useCartState(): CartState {
  return useContext(CartStateContext);
}

/** Just the lines array. */
export function useCartLines(): CartLine[] {
  return useContext(CartStateContext).lines;
}

/** Memoised totals — recomputes only when lines change. */
export function useCartTotals(): CartTotals {
  const state = useContext(CartStateContext);
  return useMemo(() => getTotals(state), [state]);
}

/** Quick selector — does the cart have a line for this product+mode? */
export function useCartLineFor(product_id: string, mode: 'detail' | 'gros'): CartLine | null {
  const lines = useCartLines();
  const id = `${product_id}:${mode}`;
  return useMemo(() => lines.find((l) => l.id === id) ?? null, [lines, id]);
}

/** Action dispatchers — never causes a re-render. */
export function useCartActions(): CartActionsAPI {
  const ctx = useContext(CartActionsContext);
  if (!ctx) {
    // We'd rather throw than silently no-op — surfaces wiring mistakes
    // immediately during development.
    throw new Error('useCartActions must be used inside <CartProvider>');
  }
  return ctx;
}

/**
 * Convenience for "Add to cart" buttons that want to know if the press
 * succeeded (e.g. to toast / haptic / animate). Always returns true
 * today since the reducer never refuses; the return type is reserved
 * for future stock validation.
 */
export function useAddToCart() {
  const { add } = useCartActions();
  return useCallback(
    (input: AddToCartInput): boolean => {
      add(input);
      return true;
    },
    [add],
  );
}
