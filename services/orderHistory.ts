/**
 * Local order history — caches a lightweight summary of orders the user
 * placed from this device. Uses `safeStorage` so it gracefully degrades to
 * in-memory when AsyncStorage's native module isn't available in the current
 * dev client build.
 */
import { safeStorage } from '@/lib/storage';

import type { SaleMode } from '@/services/orders';

const STORAGE_KEY = 'verking:order-history:v1';
const MAX_ENTRIES = 30;

export interface LocalOrderEntry {
  order_number: string;
  order_id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  mode: SaleMode;
  product_summary: string;
  status: string;
}

export async function getLocalOrders(): Promise<LocalOrderEntry[]> {
  try {
    const raw = await safeStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LocalOrderEntry[];
  } catch (err) {
    console.warn('[orderHistory] failed to read:', err);
    return [];
  }
}

export async function pushLocalOrder(entry: LocalOrderEntry): Promise<void> {
  const existing = await getLocalOrders();
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  try {
    await safeStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[orderHistory] failed to persist:', err);
  }
}

export async function clearLocalOrders(): Promise<void> {
  try {
    await safeStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[orderHistory] failed to clear:', err);
  }
}
