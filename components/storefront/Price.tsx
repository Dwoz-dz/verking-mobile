/**
 * Price tag — handles retail / sale / wholesale display.
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand } from '@/constants/theme';
import { formatPrice } from '@/lib/format';
import type { SaleMode } from '@/services/orders';

export interface PriceProps {
  price: number;
  salePrice?: number | null;
  wholesalePrice?: number | null;
  mode?: SaleMode;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right' | 'center';
  style?: StyleProp<ViewStyle>;
}

export function effectiveUnitPrice(
  price: number,
  salePrice: number | null | undefined,
  wholesalePrice: number | null | undefined,
  mode: SaleMode,
): number {
  if (mode === 'gros') return wholesalePrice ?? price;
  return salePrice ?? price;
}

export function Price({
  price,
  salePrice,
  wholesalePrice,
  mode = 'detail',
  size = 'md',
  align = 'left',
  style,
}: PriceProps) {
  const { t } = useTranslation();
  const main = effectiveUnitPrice(price, salePrice, wholesalePrice, mode);
  const showStrike = mode === 'detail' && salePrice != null && salePrice < price;
  const fontSize = size === 'lg' ? 24 : size === 'sm' ? 14 : 18;
  const alignSelf = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

  return (
    <View style={[{ alignSelf }, style]}>
      <View style={styles.row}>
        <Text style={[styles.main, { fontSize }]}>{formatPrice(main)}</Text>
        {showStrike ? <Text style={styles.strike}>{formatPrice(price)}</Text> : null}
      </View>
      {mode === 'gros' && wholesalePrice == null ? (
        <Text style={styles.note}>{t('product.wholesale_fallback')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  main: { fontWeight: '800', color: Brand.secondary },
  strike: { color: Brand.textMuted, textDecorationLine: 'line-through', fontSize: 13 },
  note: { color: Brand.textMuted, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
});
