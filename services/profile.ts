/**
 * services/profile.ts — Phase 3.1 wiring for the editable user profile.
 *
 * Reads:
 *   ▸ getMyProfile() — joins `mobile_user_profiles` with the existing
 *     registration status hook so consumers always see the full picture
 *     (name, phone, avatar, email, birth_date, bio, wilaya, tags).
 *
 * Writes:
 *   ▸ updateMyProfile(patch) — calls the SECURITY DEFINER RPC
 *     `update_my_profile` (Phase 2.2). Partial updates only;
 *     unspecified fields stay untouched.
 *
 * The hooks are realtime-aware: any change broadcast on
 * `mobile_user_profiles` for the current device_id refetches via the
 * registration bus the existing hook already subscribes to.
 */
import { useCallback, useEffect, useState } from 'react';

import { getDeviceId } from '@/lib/deviceId';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { supabase } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────

export interface FullProfile {
  device_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;     // ISO date 'YYYY-MM-DD'
  bio: string | null;
  avatar_url: string | null;
  wilaya_code: string | null;
  is_registered: boolean;
  is_suspended: boolean;
  tags: string[];
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const ZERO_PROFILE: FullProfile = {
  device_id: '',
  name: null, phone: null, email: null, birth_date: null,
  bio: null, avatar_url: null, wilaya_code: null,
  is_registered: false, is_suspended: false,
  tags: [], source: null,
  created_at: null, updated_at: null,
};

export interface UpdateProfileInput {
  name?: string | null;
  email?: string | null;
  birth_date?: string | null;   // 'YYYY-MM-DD'
  bio?: string | null;
  avatar_url?: string | null;
}

export interface UpdateProfileResult {
  ok: boolean;
  code?: string;
}

// ─── Read API ─────────────────────────────────────────────────────────

export async function getMyProfile(): Promise<FullProfile> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase
      .from('mobile_user_profiles')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();
    if (error || !data) return { ...ZERO_PROFILE, device_id: deviceId };
    const r = data as Record<string, unknown>;
    return {
      device_id:      String(r.device_id ?? deviceId),
      name:           typeof r.name === 'string' ? r.name : null,
      phone:          typeof r.phone === 'string' ? r.phone : null,
      email:          typeof r.email === 'string' ? r.email : null,
      birth_date:     typeof r.birth_date === 'string' ? r.birth_date : null,
      bio:            typeof r.bio === 'string' ? r.bio : null,
      avatar_url:     typeof r.avatar_url === 'string' ? r.avatar_url : null,
      wilaya_code:    typeof r.wilaya_code === 'string' ? r.wilaya_code : null,
      is_registered:  Boolean(r.is_registered),
      is_suspended:   Boolean(r.is_suspended),
      tags:           Array.isArray(r.tags) ? (r.tags as string[]) : [],
      source:         typeof r.source === 'string' ? r.source : null,
      created_at:     typeof r.created_at === 'string' ? r.created_at : null,
      updated_at:     typeof r.updated_at === 'string' ? r.updated_at : null,
    };
  } catch (e) {
    console.warn('[profile] getMyProfile crashed:', e);
    return ZERO_PROFILE;
  }
}

// ─── Write API ────────────────────────────────────────────────────────

export async function updateMyProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('update_my_profile', {
      p_device_id:  deviceId,
      p_name:       input.name ?? null,
      p_avatar_url: input.avatar_url ?? null,
      p_email:      input.email ?? null,
      p_birth_date: input.birth_date ?? null,
      p_bio:        input.bio ?? null,
    });
    if (error) {
      console.warn('[profile] update rpc error:', error.message);
      return { ok: false, code: error.message ?? 'RPC_ERROR' };
    }
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: Boolean(r.ok),
      code: typeof r.code === 'string' ? r.code : undefined,
    };
  } catch (e) {
    console.warn('[profile] updateMyProfile crashed:', e);
    return { ok: false, code: 'CRASH' };
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useMyProfile(): {
  profile: FullProfile;
  loading: boolean;
  reload: () => void;
} {
  const [profile, setProfile] = useState<FullProfile>(ZERO_PROFILE);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await getMyProfile();
      if (!cancelled) {
        setProfile(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick, globalTick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { profile, loading, reload };
}
