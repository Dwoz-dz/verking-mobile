/**
 * services/addresses.ts — Phase 3.2 wiring for the address book.
 *
 * Reads:
 *   ▸ list_my_addresses → all addresses for the current device, default
 *     row first.
 *
 * Writes:
 *   ▸ save_my_address (insert or update)
 *   ▸ delete_my_address
 *   ▸ set_default_address — atomic; the RPC unsets every other default
 *     before flipping the chosen one ON, so the partial unique index
 *     never trips.
 *
 * All RPCs are Phase 2.2 SECURITY DEFINER + pinned search_path. The
 * mobile app never SELECTs `mobile_user_addresses` directly (RLS locks
 * it down to RPC access).
 */
import { useCallback, useEffect, useState } from 'react';

import { getDeviceId } from '@/lib/deviceId';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { supabase } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────

export interface AddressRow {
  id: string;
  device_id: string;
  label: string;
  emoji: string | null;
  wilaya_code: string;
  commune: string | null;
  address_line1: string;
  landmark: string | null;
  phone: string;
  note: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddressInput {
  id?: string | null;
  label: string;
  emoji?: string | null;
  wilaya_code: string;
  commune?: string | null;
  address_line1: string;
  landmark?: string | null;
  phone: string;
  note?: string | null;
  is_default?: boolean;
}

export interface SaveAddressResult {
  ok: boolean;
  id?: string;
  code?: string;
}

// ─── Read ─────────────────────────────────────────────────────────────

export async function listMyAddresses(): Promise<AddressRow[]> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('list_my_addresses', { p_device_id: deviceId });
    if (error || !data) return [];
    return (data as AddressRow[]) ?? [];
  } catch (e) {
    console.warn('[addresses] list crashed:', e);
    return [];
  }
}

// ─── Write ────────────────────────────────────────────────────────────

export async function saveMyAddress(input: AddressInput): Promise<SaveAddressResult> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('save_my_address', {
      p_device_id:     deviceId,
      p_id:            input.id ?? null,
      p_label:         input.label,
      p_emoji:         input.emoji ?? '🏠',
      p_wilaya_code:   input.wilaya_code,
      p_commune:       input.commune ?? null,
      p_address_line1: input.address_line1,
      p_landmark:      input.landmark ?? null,
      p_phone:         input.phone,
      p_note:          input.note ?? null,
      p_is_default:    input.is_default ?? false,
    });
    if (error) {
      console.warn('[addresses] save error:', error.message);
      return { ok: false, code: error.message ?? 'RPC_ERROR' };
    }
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: Boolean(r.ok),
      id: typeof r.id === 'string' ? r.id : undefined,
      code: typeof r.code === 'string' ? r.code : undefined,
    };
  } catch (e) {
    console.warn('[addresses] save crashed:', e);
    return { ok: false, code: 'CRASH' };
  }
}

export async function deleteMyAddress(id: string): Promise<boolean> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('delete_my_address', {
      p_device_id: deviceId,
      p_id: id,
    });
    if (error) return false;
    return Boolean((data as { ok?: boolean } | null)?.ok);
  } catch {
    return false;
  }
}

export async function setDefaultAddress(id: string): Promise<boolean> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('set_default_address', {
      p_device_id: deviceId,
      p_id: id,
    });
    if (error) return false;
    return Boolean((data as { ok?: boolean } | null)?.ok);
  } catch {
    return false;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useMyAddresses(): {
  addresses: AddressRow[];
  loading: boolean;
  reload: () => void;
} {
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await listMyAddresses();
      if (!cancelled) {
        setAddresses(list);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick, globalTick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { addresses, loading, reload };
}
