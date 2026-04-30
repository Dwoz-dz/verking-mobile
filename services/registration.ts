/**
 * services/registration.ts — Phase 14 wire-up to the SECURITY DEFINER
 * RPCs `register_device`, `register_step2`, `register_status` and
 * `request_account_recovery`.
 *
 * The hooks and helpers exported here are the ONLY way the app talks
 * to the registration backend — every screen that needs to know "is
 * this device registered?" goes through `useRegistrationStatus()` so
 * the answer stays consistent across the home banner, drawer item,
 * cart prompt and checkout suggestion.
 */
import { useCallback, useEffect, useState } from 'react';

import { getDeviceId } from '@/lib/deviceId';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { supabase } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────

export interface RegistrationStatus {
  is_registered: boolean;
  completed_step2: boolean;
  name: string | null;
  phone: string | null;
  wilaya_code: string | null;
  is_suspended: boolean;
  tags: string[];
}

const ZERO_STATUS: RegistrationStatus = {
  is_registered: false,
  completed_step2: false,
  name: null,
  phone: null,
  wilaya_code: null,
  is_suspended: false,
  tags: [],
};

export interface RegisterResult {
  ok: boolean;
  code?: string;
  already_registered?: boolean;
  recovery_eligible?: boolean;
  granted_points: number;
  welcome_coupon_code: string | null;
}

export interface Step2Result {
  ok: boolean;
  code?: string;
  already_completed: boolean;
  granted_points: number;
}

export interface RecoveryResult {
  ok: boolean;
  code?: string;
  request_id?: string;
  duplicate?: boolean;
}

// ─── Read API ─────────────────────────────────────────────────────────

export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('register_status', { p_device_id: deviceId });
    if (error || !data) return ZERO_STATUS;
    const r = data as Record<string, unknown>;
    return {
      is_registered:   Boolean(r.is_registered),
      completed_step2: Boolean(r.completed_step2),
      name:        typeof r.name === 'string' ? r.name : null,
      phone:       typeof r.phone === 'string' ? r.phone : null,
      wilaya_code: typeof r.wilaya_code === 'string' ? r.wilaya_code : null,
      is_suspended: Boolean(r.is_suspended),
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    };
  } catch {
    return ZERO_STATUS;
  }
}

// ─── Write API ────────────────────────────────────────────────────────

export async function registerDevice(input: {
  name: string;
  phone: string;
  wilayaCode?: string | null;
  referrerCode?: string | null;
}): Promise<RegisterResult> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('register_device', {
      p_device_id:     deviceId,
      p_name:          input.name,
      p_phone:         input.phone,
      p_wilaya_code:   input.wilayaCode ?? null,
      p_referrer_code: input.referrerCode ?? null,
    });
    if (error) {
      console.warn('[registration] register_device error:', error.message);
      return zeroRegister(error.message ?? 'RPC_ERROR');
    }
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: Boolean(r.ok),
      code: typeof r.code === 'string' ? r.code : undefined,
      already_registered: Boolean(r.already_registered),
      recovery_eligible: Boolean(r.recovery_eligible),
      granted_points: Number(r.granted_points) || 0,
      welcome_coupon_code:
        typeof r.welcome_coupon_code === 'string' ? r.welcome_coupon_code : null,
    };
  } catch (e) {
    console.warn('[registration] register_device crashed:', e);
    return zeroRegister('CRASH');
  }
}

export async function registerStep2(input: {
  wilayaCode: string;
  levelKey?: string | null;
}): Promise<Step2Result> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('register_step2', {
      p_device_id:   deviceId,
      p_wilaya_code: input.wilayaCode,
      p_level_key:   input.levelKey ?? null,
    });
    if (error) {
      console.warn('[registration] step2 error:', error.message);
      return { ok: false, code: error.message ?? 'RPC_ERROR', already_completed: false, granted_points: 0 };
    }
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: Boolean(r.ok),
      code: typeof r.code === 'string' ? r.code : undefined,
      already_completed: Boolean(r.already_completed),
      granted_points: Number(r.granted_points) || 0,
    };
  } catch {
    return { ok: false, code: 'CRASH', already_completed: false, granted_points: 0 };
  }
}

export async function requestAccountRecovery(input: {
  phone: string;
  reason?: string;
}): Promise<RecoveryResult> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('request_account_recovery', {
      p_new_device_id: deviceId,
      p_phone:         input.phone,
      p_reason:        input.reason ?? null,
    });
    if (error) {
      console.warn('[registration] recovery error:', error.message);
      return { ok: false, code: error.message ?? 'RPC_ERROR' };
    }
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: Boolean(r.ok),
      code: typeof r.code === 'string' ? r.code : undefined,
      request_id: typeof r.request_id === 'string' ? r.request_id : undefined,
      duplicate: Boolean(r.duplicate),
    };
  } catch {
    return { ok: false, code: 'CRASH' };
  }
}

function zeroRegister(code: string): RegisterResult {
  return { ok: false, code, already_registered: false, granted_points: 0, welcome_coupon_code: null };
}

// ─── Hook ─────────────────────────────────────────────────────────────

/**
 * useRegistrationStatus — subscribes once on mount, exposes `reload()`
 * for callers that just performed a write (e.g. the register screen).
 */
export function useRegistrationStatus(): {
  status: RegistrationStatus;
  loading: boolean;
  reload: () => void;
} {
  const [status, setStatus] = useState<RegistrationStatus>(ZERO_STATUS);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await getRegistrationStatus();
      if (!cancelled) {
        setStatus(s);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick, globalTick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { status, loading, reload };
}
