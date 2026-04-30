/**
 * Détail / Gros segmented toggle — Détail = orange (CTA accent),
 * Gros = mint. RTL-aware.
 */
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Radius } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import type { SaleMode } from '@/services/orders';

interface ModeToggleProps {
  value: SaleMode;
  onChange: (next: SaleMode) => void;
  style?: StyleProp<ViewStyle>;
}

export function ModeToggle({ value, onChange, style }: ModeToggleProps) {
  const { t } = useTranslation();
  const { rowDirection } = useDirection();

  const modes: { key: SaleMode; label: string; sub: string; activeBg: string; activeFg: string }[] = [
    { key: 'detail', label: t('modes.detail'), sub: t('modes.detail_sub'), activeBg: Brand.cta, activeFg: '#FFFFFF' },
    { key: 'gros', label: t('modes.gros'), sub: t('modes.gros_sub'), activeBg: Brand.mint, activeFg: Brand.secondary },
  ];

  return (
    <View style={[styles.container, { flexDirection: rowDirection }, style]}>
      {modes.map((m) => {
        const active = value === m.key;
        return (
          <Pressable
            key={m.key}
            onPress={() => onChange(m.key)}
            style={[styles.option, active && { backgroundColor: m.activeBg }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && { color: m.activeFg }]}>{m.label}</Text>
            <Text style={[styles.sub, active && { color: m.activeFg, opacity: 0.85 }]}>{m.sub}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Brand.surfaceMuted, borderRadius: Radius.pill, padding: 4, gap: 4 },
  option: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: Radius.pill, alignItems: 'center' },
  label: { fontWeight: '800', color: Brand.secondary, fontSize: 14 },
  sub: { fontSize: 11, color: Brand.textMuted, fontWeight: '600' },
});
