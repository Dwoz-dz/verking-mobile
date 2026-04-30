/**
 * WhatsApp helper.
 *
 * Phone number is read dynamically from `store_settings.whatsapp_number`
 * (managed in the website/admin dashboard). The button is hidden whenever
 * that setting is empty so we never link to a placeholder number.
 *
 * Default messages and order template strings come from the i18n layer so
 * they switch with the user's selected language.
 */
import { Linking } from 'react-native';

import { i18next } from '@/i18n';
import { getSetting } from '@/services/settings';
import type { SaleMode } from '@/services/orders';

const SETTING_KEY = 'whatsapp_number';

function sanitize(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D+/g, '');
  if (digits.length < 8) return null;
  return digits;
}

let cached: string | null | undefined;

export async function getWhatsAppNumber(): Promise<string | null> {
  if (cached !== undefined) return cached;
  const raw = await getSetting<string>(SETTING_KEY);
  cached = sanitize(raw);
  return cached;
}

export function clearWhatsAppCache(): void {
  cached = undefined;
}

export interface WhatsAppMessageOptions {
  customerName?: string;
  mode?: SaleMode;
  productName?: string;
  productId?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  currency?: string;
  extra?: string;
}

function formatPrice(amount: number | undefined, currency?: string): string | null {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return null;
  const c = currency ?? i18next.t('common.currency');
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} ${c}`;
}

export function buildOrderMessage(opts: WhatsAppMessageOptions): string {
  const t = (key: string, vars?: Record<string, unknown>) => i18next.t(key, vars);
  const lines: string[] = [];
  lines.push(t('whatsapp.order_template_greeting'));
  lines.push('');
  if (opts.customerName) lines.push(t('whatsapp.order_template_name', { name: opts.customerName }));
  if (opts.productName) {
    lines.push(
      t('whatsapp.order_template_product', {
        name: opts.productName,
        id: opts.productId ? opts.productId.slice(0, 8) : '',
      }),
    );
  }
  if (opts.mode) {
    lines.push(
      t('whatsapp.order_template_mode', { mode: opts.mode === 'gros' ? t('modes.gros') : t('modes.detail') }),
    );
  }
  if (opts.quantity) lines.push(t('whatsapp.order_template_qty', { qty: opts.quantity }));
  const unit = formatPrice(opts.unitPrice, opts.currency);
  if (unit) lines.push(t('whatsapp.order_template_unit', { price: unit }));
  const total = formatPrice(opts.total, opts.currency);
  if (total) lines.push(t('whatsapp.order_template_total', { price: total }));
  if (opts.extra) {
    lines.push('');
    lines.push(opts.extra);
  }
  lines.push('');
  lines.push(t('whatsapp.order_template_thanks'));
  return lines.join('\n');
}

export async function buildDefaultMessage(): Promise<string> {
  return i18next.t('whatsapp.default_message');
}

/**
 * One product line in a multi-product cart message. Minimal shape so the
 * same call site works whether the cart was hydrated from storage or
 * built ad-hoc.
 */
export interface CartWhatsAppLine {
  name: string;
  mode: SaleMode;
  qty: number;
  unit_price: number;
}

export interface CartWhatsAppOptions {
  customerName?: string;
  lines: CartWhatsAppLine[];
  total?: number;
  currency?: string;
  extra?: string;
}

/**
 * Build a multi-line WhatsApp message for a full cart. Used by the
 * "Commander via WhatsApp" CTA in the cart screen so the merchant
 * receives a structured order rather than a plain stub.
 */
export function buildCartMessage(opts: CartWhatsAppOptions): string {
  const t = (key: string, vars?: Record<string, unknown>) => i18next.t(key, vars);
  const lines: string[] = [];
  lines.push(t('whatsapp.order_template_greeting'));
  lines.push('');
  if (opts.customerName) {
    lines.push(t('whatsapp.order_template_name', { name: opts.customerName }));
    lines.push('');
  }
  for (const item of opts.lines) {
    const lineTotal = item.qty * item.unit_price;
    const modeLabel = item.mode === 'gros' ? t('modes.gros') : t('modes.detail');
    const formattedLine = formatPrice(lineTotal, opts.currency) ?? '';
    lines.push(`- ${item.name} (${modeLabel}) x${item.qty} - ${formattedLine}`);
  }
  const total = formatPrice(opts.total, opts.currency);
  if (total) {
    lines.push('');
    lines.push(t('whatsapp.order_template_total', { price: total }));
  }
  if (opts.extra) {
    lines.push('');
    lines.push(opts.extra);
  }
  lines.push('');
  lines.push(t('whatsapp.order_template_thanks'));
  return lines.join('\n');
}

export interface OpenWhatsAppOptions extends WhatsAppMessageOptions {
  message?: string;
}

export async function openWhatsApp(opts: OpenWhatsAppOptions = {}): Promise<boolean> {
  const phone = await getWhatsAppNumber();
  if (!phone) return false;
  const text =
    opts.message ?? (Object.keys(opts).length > 0 ? buildOrderMessage(opts) : await buildDefaultMessage());
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch (err) {
    console.warn('[whatsapp] failed to open URL:', err);
    return false;
  }
}
