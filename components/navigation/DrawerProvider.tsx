/**
 * DrawerProvider — global open/close state for the side menu.
 *
 * The drawer renders ONCE at the root layout and is controlled from
 * any screen via `useDrawer().open()`. This avoids per-tab drawer
 * mounts (which would lose state on tab switch) and keeps the
 * animation pipeline single-source-of-truth.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface DrawerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open   = useCallback(() => setIsOpen(true), []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((p) => !p), []);

  const value = useMemo(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle]);
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) {
    // Don't crash — return a safe no-op so screens that mount before
    // the provider (or in tests) still render.
    return { isOpen: false, open: () => {}, close: () => {}, toggle: () => {} };
  }
  return ctx;
}
