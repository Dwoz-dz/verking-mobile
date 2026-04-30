/**
 * Quantity stepper — minus / value / plus, with optional min/max bounds.
 */
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Radius } from '@/constants/theme';

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  style?: StyleProp<ViewStyle>;
}

export function QuantityStepper({ value, onChange, min = 1, max, style }: QuantityStepperProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(max ? Math.min(max, value + 1) : value + 1);
  const decDisabled = value <= min;
  const incDisabled = max != null && value >= max;

  return (
    <View style={[styles.container, style]}>
      <Pressable
        onPress={dec}
        disabled={decDisabled}
        style={[styles.btn, decDisabled && styles.btnDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Diminuer la quantité"
      >
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        onPress={inc}
        disabled={incDisabled}
        style={[styles.btn, incDisabled && styles.btnDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Augmenter la quantité"
      >
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 6,
    alignSelf: 'flex-start',
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: Brand.border },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 18, lineHeight: 20 },
  value: {
    minWidth: 36,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
    color: Brand.secondary,
  },
});
