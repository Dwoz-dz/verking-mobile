/**
 * CountdownTimer — flash-sale countdown chip.
 *
 * Renders a compact "23h 14m 02s" display until `endsAt`, then signals
 * its parent via `onExpire` so the host can hide / refetch / replace
 * the row. Designed for ProductCard but reusable anywhere a sale_price
 * has a `promo_end_at`.
 *
 * Props:
 *   ▸ endsAt   — ISO timestamp string from products.promo_end_at.
 *   ▸ size     — 'xs' | 'sm' | 'md' (default 'sm')
 *   ▸ onExpire — fired once the timer reaches 0.
 *
 * Implementation notes:
 *   - 1s ticker via setInterval — single timer per mounted instance.
 *   - When the remaining window is > 24h we display "Xj Yh".
 *   - When < 1h we tint the chip red to convey urgency.
 *   - Renders nothing if endsAt is invalid or already past on mount.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, BrandFont } from '@/constants/theme';

interface CountdownTimerProps {
  endsAt: string | null | undefined;
  size?: 'xs' | 'sm' | 'md';
  onExpire?: () => void;
  style?: StyleProp<ViewStyle>;
}

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function partsFor(target: number, now: number): Parts {
  const diff = Math.max(0, target - now);
  const totalMs = diff;
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3_600);
  const minutes = Math.floor((totalSec % 3_600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, totalMs };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function CountdownTimer({ endsAt, size = 'sm', onExpire, style }: CountdownTimerProps) {
  const targetMs = useMemo(() => {
    if (!endsAt) return null;
    const t = Date.parse(endsAt);
    return Number.isFinite(t) ? t : null;
  }, [endsAt]);

  const [parts, setParts] = useState<Parts>(() =>
    targetMs == null ? { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 } : partsFor(targetMs, Date.now()),
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    if (targetMs == null) return;
    const tick = () => {
      const next = partsFor(targetMs, Date.now());
      setParts(next);
      if (next.totalMs <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs, onExpire]);

  if (targetMs == null) return null;
  if (parts.totalMs <= 0) return null;

  const urgent = parts.totalMs < 60 * 60 * 1000; // < 1h
  const tint = urgent ? Brand.danger : Brand.cta;
  const tintSoft = urgent ? Brand.dangerSoft : Brand.ctaSoft;

  const fontSize = size === 'xs' ? 10 : size === 'md' ? 14 : 12;
  const padV = size === 'xs' ? 2 : 3;
  const padH = size === 'xs' ? 6 : 8;
  const iconSize = size === 'xs' ? 10 : size === 'md' ? 14 : 12;

  let label: string;
  if (parts.days >= 1) {
    label = `${parts.days}j ${pad(parts.hours)}h`;
  } else if (parts.hours >= 1) {
    label = `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
  } else {
    label = `${pad(parts.minutes)}:${pad(parts.seconds)}`;
  }

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: tintSoft, paddingHorizontal: padH, paddingVertical: padV },
        style,
      ]}
    >
      <Ionicons name="time-outline" size={iconSize} color={tint} />
      <Text style={[styles.text, { color: tint, fontSize }]} allowFontScaling={false}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
