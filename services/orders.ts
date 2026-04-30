/**
 * Order service — talks to the `mobile-create-order` Edge Function.
 *
 * The mobile app no longer writes to `orders` / `order_items` directly;
 * those tables are locked by RLS. Instead we send a normalised payload to
 * the Edge Function, which validates everything server-side, computes the
 * unit price from the products table (so the client cannot tamper), and
 * inserts using the service-role key.
 *
 * The function URL is derived from EXPO_PUBLIC_SUPABASE_URL.
 */
import type { OrderRow } from '@/types/database';

export type SaleMode = 'detail' | 'gros';

export interface QuickOrderLine {
  product_id: string;
  product_name: string;
  /** Kept in the type for the local-history summary; NOT sent to the server. */
  unit_price: number;
  quantity: number;
}

export interface QuickOrderInput {
  customer_name: string;
  customer_phone: string;
  customer_address?: string | null;
  customer_wilaya?: string | null;
  customer_email?: string | null;
  /** Reserved for future use; the Edge Function defaults to 'home'/'cod'. */
  delivery_type?: string | null;
  payment_method?: string | null;
  mode: SaleMode;
  lines: QuickOrderLine[];
  /** Reserved; ignored by the function (always 0 today). */
  shipping?: number;
  notes?: string | null;
  /** Phase 3.5 — wallet row id; the server re-validates ownership + applicability. */
  applied_user_coupon_id?: string | null;
  /** Phase 3.5 — required when applied_user_coupon_id is set. */
  device_id?: string | null;
}

export interface OrderCreatedResponse {
  id: string;
  order_number: string;
  subtotal: number;
  total: number;
  status: string;
  created_at: string;
}

interface EdgeOk {
  ok: true;
  order: OrderCreatedResponse & {
    discount?: number;
    applied_coupon?: { code: string; discount: number } | null;
  };
}
interface EdgeErr {
  ok: false;
  error: string;
  code: string;
  fields?: string[];
}

/**
 * Map server-side error codes to user-facing French strings. The mobile UI
 * shows these directly. (The i18n layer can later swap these via t().)
 */
const ERROR_MESSAGES: Record<string, string> = {
  INVALID_NAME: 'Veuillez saisir un nom valide.',
  INVALID_PHONE: 'Numéro de téléphone invalide.',
  INVALID_MODE: 'Mode de vente invalide.',
  INVALID_LINES: 'Aucun article dans la commande.',
  INVALID_LINE: 'Ligne de commande invalide.',
  INVALID_PRODUCT_ID: 'Identifiant de produit invalide.',
  INVALID_QUANTITY: 'Quantité invalide.',
  PRODUCT_NOT_FOUND: 'Produit introuvable.',
  PRODUCT_INACTIVE: 'Ce produit n’est plus disponible.',
  BELOW_GROS_MIN: 'Quantité inférieure au minimum Gros requis.',
  INSUFFICIENT_STOCK: 'Stock insuffisant pour cette quantité.',
  OUT_OF_STOCK: 'Produit en rupture de stock.',
  PAYLOAD_TOO_LARGE: 'Commande trop volumineuse.',
  RATE_LIMITED: 'Trop de tentatives, réessayez dans quelques minutes.',
  BAD_JSON: 'Erreur de communication avec le serveur.',
  NO_SERVICE_ROLE: 'Service indisponible, réessayez plus tard.',
  PRODUCT_LOOKUP: 'Erreur de chargement des produits.',
  ORDER_INSERT: 'Échec de la création de la commande.',
  ITEMS_INSERT: 'Échec de l’enregistrement des articles.',
  INTERNAL: 'Erreur serveur.',
  METHOD_NOT_ALLOWED: 'Méthode non autorisée.',
  COUPON_NOT_FOUND: 'Coupon introuvable.',
  COUPON_NOT_OWNED: 'Coupon non rattaché à ce téléphone.',
  COUPON_USED: 'Coupon déjà utilisé.',
  COUPON_INACTIVE: 'Coupon désactivé.',
  COUPON_NOT_STARTED: 'Coupon pas encore actif.',
  COUPON_EXPIRED: 'Coupon expiré.',
  COUPON_LOOKUP: 'Erreur de chargement du coupon.',
  COUPON_MISSING: 'Coupon introuvable.',
  BELOW_MIN_CART: 'Sous-total trop bas pour ce coupon.',
  WILAYA_NOT_TARGETED: 'Coupon non valide dans cette wilaya.',
  INVALID_USER_COUPON_ID: 'Identifiant coupon invalide.',
  MISSING_DEVICE_ID: 'Identifiant appareil manquant.',
};

export class OrderError extends Error {
  code: string;
  fields?: string[];
  constructor(code: string, fallback: string, fields?: string[]) {
    super(ERROR_MESSAGES[code] ?? fallback);
    this.code = code;
    this.fields = fields;
  }
}

function getEndpoint(): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  if (!base) throw new OrderError('NO_SERVICE_ROLE', 'Configuration Supabase manquante.');
  return `${base}/functions/v1/mobile-create-order`;
}

function getAnonKey(): string {
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new OrderError('NO_SERVICE_ROLE', 'Clé Supabase manquante.');
  return key;
}

export async function createQuickOrder(input: QuickOrderInput): Promise<OrderRow> {
  if (!input.lines || input.lines.length === 0) {
    throw new OrderError('INVALID_LINES', 'Aucun article dans la commande.');
  }

  const payload: Record<string, unknown> = {
    customer: {
      name: input.customer_name,
      phone: input.customer_phone,
      wilaya: input.customer_wilaya ?? null,
      address: input.customer_address ?? null,
      email: input.customer_email ?? null,
    },
    mode: input.mode,
    lines: input.lines.map((l) => ({
      product_id: l.product_id,
      quantity: l.quantity,
    })),
    notes: input.notes ?? null,
  };
  if (input.applied_user_coupon_id) {
    payload.applied_user_coupon_id = input.applied_user_coupon_id;
    payload.device_id = input.device_id ?? null;
  }

  const url = getEndpoint();
  const anonKey = getAnonKey();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[orders] network failure:', err);
    throw new OrderError(
      'INTERNAL',
      'Connexion impossible. Vérifiez votre internet et réessayez.',
    );
  }

  let parsed: EdgeOk | EdgeErr;
  try {
    parsed = (await response.json()) as EdgeOk | EdgeErr;
  } catch {
    throw new OrderError('INTERNAL', `Réponse invalide du serveur (HTTP ${response.status}).`);
  }

  if (!response.ok || !parsed.ok) {
    const err = parsed as EdgeErr;
    throw new OrderError(err.code ?? 'INTERNAL', err.error ?? 'Erreur serveur.', err.fields);
  }

  // Normalise to the OrderRow shape used by the rest of the app.
  const o = parsed.order;
  return {
    id: o.id,
    order_number: o.order_number,
    customer_id: null,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    customer_email: input.customer_email ?? null,
    customer_address: input.customer_address ?? null,
    customer_wilaya: input.customer_wilaya ?? null,
    subtotal: o.subtotal,
    shipping: 0,
    discount: typeof o.discount === 'number' ? o.discount : 0,
    total: o.total,
    payment_method: 'cod',
    delivery_type: 'home',
    status: o.status,
    notes: input.notes ?? null,
    admin_note: '',
    created_at: o.created_at,
    updated_at: o.created_at,
  };
}
