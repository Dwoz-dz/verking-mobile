/**
 * RailWithPlaceholders — horizontal product rail that auto-fills empty
 * slots with `<ComingSoonCard />`.
 *
 * Phase Final — DRY wrapper used by Home and Boutique so every product
 * rail shares one consistent "never-empty" rule:
 *   ▸ N real products rendered first.
 *   ▸ If N < `minSlots` (admin-driven, default 8) AND the coming-soon
 *     config is enabled, the gap is filled with placeholders.
 *   ▸ Each placeholder gets a stable hash-based index so the rail
 *     doesn't re-shuffle on every re-render.
 *
 * The component is a *composer* — it owns the ScrollView so callers
 * just pass the data + a `renderProduct` function (so they can keep
 * their existing `<ProductCard />` props pristine).
 */
import * as React from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ComingSoonCard } from '@/components/ui/ComingSoonCard';
import { Spacing } from '@/constants/theme';
import { useComingSoonConfig } from '@/services/comingSoonConfig';

interface RailWithPlaceholdersProps<T> {
  /** Real products to render. */
  items: T[];
  /** Renders a real product card from your existing component. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Stable key extractor — usually `(item) => item.id`. */
  keyExtractor: (item: T, index: number) => string;
  /** Locale code — passed to `<ComingSoonCard />` for the message pool. */
  locale: 'fr' | 'ar' | 'en';
  /** Per-card width to keep the rail visually consistent. Default 168. */
  cardWidth?: number;
  /** Override the admin's `min_grid_slots`. */
  minSlots?: number;
  /** Visual style overrides for the inner container. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Stable bucket name used to seed placeholder variation. */
  bucketKey: string;
}

export function RailWithPlaceholders<T>({
  items,
  renderItem,
  keyExtractor,
  locale,
  cardWidth = 168,
  minSlots,
  contentContainerStyle,
  bucketKey,
}: RailWithPlaceholdersProps<T>) {
  const config = useComingSoonConfig();
  const targetSlots = minSlots ?? config.min_grid_slots;
  // Hide placeholders entirely if admin disabled coming-soon UI.
  const placeholderCount = config.enabled
    ? Math.max(0, targetSlots - items.length)
    : 0;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.rail, contentContainerStyle]}
    >
      {items.map((item, i) => (
        <React.Fragment key={keyExtractor(item, i)}>
          {renderItem(item, i)}
        </React.Fragment>
      ))}
      {Array.from({ length: placeholderCount }).map((_, i) => (
        <ComingSoonCard
          key={`ph-${bucketKey}-${i}`}
          // bucketKey + index → deterministic. Different bucketKey on
          // each rail means the user sees varied messages even when
          // multiple rails fill placeholders simultaneously.
          index={i + bucketKey.charCodeAt(0)}
          locale={locale}
          width={cardWidth}
          titlePool={locale === 'ar' ? config.pool_titles_ar : config.pool_titles_fr}
          emojiPool={config.pool_emojis}
          showNotifyCta={config.show_notify_cta}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingBottom: 4 },
});

export default RailWithPlaceholders;
