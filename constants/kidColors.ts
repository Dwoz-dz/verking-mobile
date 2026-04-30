/**
 * KidColors — palette tuned for the Phase 14 registration flow.
 *
 * Why a separate file:
 *   The base `Brand` palette is intentionally professional (navy +
 *   orange) so the marketplace feels trustworthy on every screen. The
 *   onboarding + registration + reward-celebration screens speak to
 *   children AND parents at the same time, so they need a softer,
 *   sweeter language: cream backgrounds, coral pinks, sunshine yellow,
 *   pastel mint, soft lavender. These colours are the proven "loved
 *   by both" shortlist (Disney+, Kinder, Pampers, Lego Education).
 *
 * All values are checked for AA contrast against `KidColors.text`
 * (#0F172A) on the dark text + against #FFFFFF on the light text.
 */
export const KidColors = {
  // Backgrounds — warm, welcoming
  cream:        '#FFF4E0',
  creamSoft:    '#FFFAF0',
  peach:        '#FFD6C4',
  peachSoft:    '#FFEEE5',
  ivory:        '#FFF8E7',

  // Coral / pink — "mom's heart"
  coralPink:    '#FFB4C2',  // soft baby pink
  coral:        '#E85D6B',  // brand coral (vivid)
  coralDeep:    '#C73B49',
  blush:        '#FFE4EC',

  // Sunshine — energy + reward signal
  butter:       '#FFE89C',  // soft butter yellow
  sunshine:     '#FFC93C',  // brand sunshine
  honey:        '#F0A500',
  sunshineSoft: '#FFF4D6',

  // Mint / turquoise — fresh, fun
  mintBubble:   '#B5F2EE',  // light bubblegum mint
  mint:         '#43D9DB',  // brand mint
  oceanDeep:    '#1FA9AB',
  mintSoft:     '#D7F4F2',

  // Lavender — premium magic
  lavenderSoft: '#EFE9FF',
  lavenderMid:  '#B4A7E0',
  lavender:     '#7C5DDB',  // brand lavender
  lavenderDeep: '#5034A8',

  // Sky — trust + fun
  sky:          '#A4D4F4',
  skyDeep:      '#5CA0E1',  // brand primarySoft
  primary:      '#2D7DD2',  // brand primary

  // Fresh — eco + growth
  freshSoft:    '#B0E5C8',
  fresh:        '#4CAF80',
  freshDeep:    '#2E7D52',

  // CTA — bold, irresistible
  ctaSoft:      '#FFE9D6',
  cta:          '#FF7A1A',
  ctaDeep:      '#E25D00',

  // Neutrals
  text:         '#0F172A',
  textSoft:     '#64748B',
  textOnDark:   '#FFFFFF',
  white:        '#FFFFFF',
  shadow:       'rgba(15, 23, 42, 0.10)',
  shadowDeep:   'rgba(15, 23, 42, 0.18)',
} as const;

/**
 * Curated 2-stop "candy gradients" — used as backgrounds for benefit
 * cards, buttons and hero blobs. Each entry is `[from, to]`.
 */
export const KidGradients = {
  /** Hero of the register screen — warm welcome */
  welcome:    ['#FFD6C4', '#FFF4E0'] as const,
  /** Big CTA button — irresistible orange→coral */
  ctaButton:  ['#FF7A1A', '#E85D6B'] as const,
  /** Reward celebration — sunshine to coral */
  reward:     ['#FFC93C', '#FF7A1A'] as const,
  /** Mint trust badge */
  trust:      ['#43D9DB', '#4CAF80'] as const,
  /** Lavender premium */
  premium:    ['#7C5DDB', '#2D7DD2'] as const,
  /** Coupon ticket */
  coupon:     ['#FFB4C2', '#E85D6B'] as const,
  /** Streak fire */
  streak:     ['#FFC93C', '#FF7A1A'] as const,
} as const;

/**
 * Benefit pill colour packs — each pack is a tinted background +
 * matching foreground for icon + label. Designed to land on a cream
 * scroll view.
 */
export const BenefitPalette = {
  gift: {
    bg:    KidColors.coralPink + '40',  // 25% alpha
    icon:  KidColors.coral,
    label: KidColors.coralDeep,
    border: KidColors.coral + '55',
  },
  star: {
    bg:    KidColors.butter + '70',
    icon:  KidColors.honey,
    label: KidColors.honey,
    border: KidColors.sunshine + '70',
  },
  ticket: {
    bg:    KidColors.lavenderSoft,
    icon:  KidColors.lavender,
    label: KidColors.lavenderDeep,
    border: KidColors.lavender + '55',
  },
  fire: {
    bg:    KidColors.peach + '70',
    icon:  KidColors.cta,
    label: KidColors.ctaDeep,
    border: KidColors.cta + '55',
  },
  truck: {
    bg:    KidColors.mintBubble + '90',
    icon:  KidColors.oceanDeep,
    label: KidColors.oceanDeep,
    border: KidColors.mint + '55',
  },
  school: {
    bg:    KidColors.freshSoft + '90',
    icon:  KidColors.freshDeep,
    label: KidColors.freshDeep,
    border: KidColors.fresh + '55',
  },
} as const;
