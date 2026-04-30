/**
 * services/contact.ts — admin-driven Support channels.
 *
 * The three contact paths (WhatsApp / phone / email) come from
 * `mobile_cart_settings` so the brand can change them without an app
 * rebuild. We read with `cache: false` for the support sheet so the
 * user always sees the latest number, and fall back to safe brand
 * constants only when the row genuinely has no value.
 *
 * Why no hardcoded numbers in the rest of the codebase:
 *   Support channels rotate as the team scales. Hardcoding a phone
 *   means every rotation ships an APK release. Reading from the
 *   admin-driven row keeps the cycle fast and lets the support team
 *   change the line themselves through the admin UI.
 */
import { Linking, Platform } from 'react-native';

import { getMobileCartConfig } from '@/services/mobileConfig';

export interface ContactChannels {
  whatsapp: string | null;     // E.164-ish number, e.g. "+213551234567"
  phone: string | null;        // raw or international
  email: string | null;        // RFC 5322
  /** True when AT LEAST ONE channel is wired, false otherwise. */
  available: boolean;
}

// Last-resort fallbacks. These ONLY apply when the admin row holds no
// value — never override an admin-set value. Update via Gestionnaire
// Mobile → Paramètres panier → Support.
const FALLBACKS = {
  whatsapp: '+213000000000',
  phone:    null,
  email:    null,
} as const;

/** Pull the support channels from `mobile_cart_settings`. */
export async function getSupportChannels(): Promise<ContactChannels> {
  try {
    const cfg = await getMobileCartConfig();

    const channels: ContactChannels = {
      whatsapp: cfg.support_whatsapp ?? FALLBACKS.whatsapp,
      phone:    cfg.support_phone    ?? FALLBACKS.phone,
      email:    cfg.support_email    ?? FALLBACKS.email,
      available: false,
    };
    channels.available = Boolean(channels.whatsapp || channels.phone || channels.email);
    return channels;
  } catch (err) {
    console.warn('[contact] getSupportChannels failed:', err);
    return {
      whatsapp: FALLBACKS.whatsapp,
      phone:    FALLBACKS.phone,
      email:    FALLBACKS.email,
      available: Boolean(FALLBACKS.whatsapp),
    };
  }
}

// ─── Open helpers ─────────────────────────────────────────────────────

export async function openWhatsApp(message?: string): Promise<boolean> {
  const { whatsapp } = await getSupportChannels();
  if (!whatsapp) return false;
  const e164 = whatsapp.replace(/[^\d+]/g, '').replace(/^\+/, '');
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  const url = `https://wa.me/${e164}${text}`;
  return openExternal(url);
}

export async function openPhone(): Promise<boolean> {
  const { phone } = await getSupportChannels();
  if (!phone) return false;
  return openExternal(`tel:${phone.replace(/\s+/g, '')}`);
}

export async function openEmail(subject?: string, body?: string): Promise<boolean> {
  const { email } = await getSupportChannels();
  if (!email) return false;
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  return openExternal(`mailto:${email}${qs}`);
}

async function openExternal(url: string): Promise<boolean> {
  try {
    const can = await Linking.canOpenURL(url);
    if (!can && Platform.OS !== 'web') return false;
    await Linking.openURL(url);
    return true;
  } catch (err) {
    console.warn('[contact] open failed', url, err);
    return false;
  }
}
