/**
 * Supabase client for the VERKING mobile app.
 *
 * Reads credentials from EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
 * These are exposed to the JS bundle by design (Expo's public env contract).
 * Only the publishable / anon key is acceptable here — never the service_role
 * key.
 *
 * Auth persistence uses `safeStorage`, which prefers AsyncStorage when the
 * native module is linked and silently falls back to in-memory storage when
 * it isn't. This lets the app boot even on a dev client that was built before
 * @react-native-async-storage/async-storage was added.
 *
 * The client is intentionally untyped at the Supabase generic level — we keep
 * our own minimal row types in `@/types/database` and cast results in the
 * services layer.
 */
import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { safeStorage } from '@/lib/storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[verking] EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required. ' +
      'Copy .env.example to .env and fill them in.',
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
  {
    auth: {
      storage: safeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
