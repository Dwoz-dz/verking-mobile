/**
 * WilayaPickerModal — full-screen modal that lets the user pick their
 * default wilaya. Drives the Home strip, ProductCard ETA, and cart
 * shipping fee.
 *
 * Shows only enabled wilayas (i.e. those whose `mobile_shipping_zones`
 * row has `is_enabled = true`). Sections grouped by region in the
 * standard Algerian commercial order: Centre, Est, Ouest, Sud.
 *
 * Search matches the 2-digit code, the French name, or the Arabic
 * name. RTL layout works automatically through `useDirection`.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';
import {
  useShippingZones,
  useWilayas,
  type ShippingZoneRow,
  type WilayaRegion,
  type WilayaRow,
} from '@/services/mobileConfig';

const REGION_ORDER: WilayaRegion[] = ['centre', 'est', 'ouest', 'sud'];

interface WilayaPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onPick: (code: string) => void;
  selectedCode?: string | null;
}

interface RowData {
  type: 'header' | 'wilaya';
  region?: WilayaRegion;
  wilaya?: WilayaRow;
  zone?: ShippingZoneRow | null;
}

export function WilayaPickerModal({
  visible, onClose, onPick, selectedCode,
}: WilayaPickerModalProps) {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const isAr = i18n.language === 'ar';

  const wilayas = useWilayas();
  const zones = useShippingZones();
  const [search, setSearch] = useState('');

  const zoneByCode = useMemo(() => {
    const m = new Map<string, ShippingZoneRow>();
    for (const z of zones) m.set(z.wilaya_code, z);
    return m;
  }, [zones]);

  const rows = useMemo<RowData[]>(() => {
    const q = search.trim().toLowerCase();
    const enabledOnly = wilayas.filter((w) => {
      const z = zoneByCode.get(w.code);
      // Only show wilayas whose shipping zone is enabled. If the zone is
      // missing entirely, fall back to "shown" so we don't hide all 58
      // wilayas on first load before zones arrive.
      if (z && !z.is_enabled) return false;
      if (!q) return true;
      return (
        w.code.includes(q) ||
        w.name_fr.toLowerCase().includes(q) ||
        w.name_ar.includes(q)
      );
    });

    const out: RowData[] = [];
    for (const region of REGION_ORDER) {
      const inRegion = enabledOnly.filter((w) => w.region === region);
      if (inRegion.length === 0) continue;
      out.push({ type: 'header', region });
      for (const w of inRegion) {
        out.push({ type: 'wilaya', wilaya: w, zone: zoneByCode.get(w.code) ?? null });
      }
    }
    return out;
  }, [wilayas, zoneByCode, search]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.header, { flexDirection: rowDirection }]}>
          <Text style={[styles.title, { textAlign }]}>{t('geo.pick_wilaya_title')}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={Brand.text} />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={Brand.textMuted} style={styles.searchIcon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('geo.pick_wilaya_search')}
            placeholderTextColor={Brand.textMuted}
            style={[styles.searchInput, { textAlign }]}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        <FlatList
          data={rows}
          keyExtractor={(item, idx) =>
            item.type === 'header' ? `h-${item.region}` : `${item.wilaya!.code}-${idx}`
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { textAlign }]}>{t('geo.pick_wilaya_empty')}</Text>
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <Text style={[styles.regionHeader, { textAlign }]}>
                  {t(`geo.region_${item.region}` as const)}
                </Text>
              );
            }
            const w = item.wilaya!;
            const zone = item.zone;
            const selected = selectedCode === w.code;
            const feeLabel = zone
              ? zone.fee > 0
                ? formatPrice(zone.fee)
                : t('geo.fee_free')
              : null;
            return (
              <Pressable
                onPress={() => onPick(w.code)}
                style={[
                  styles.row,
                  { flexDirection: rowDirection },
                  selected && styles.rowSelected,
                ]}
              >
                <View style={styles.codePill}>
                  <Text style={styles.codePillText}>{w.code}</Text>
                </View>
                <View style={styles.rowMain}>
                  <Text style={[styles.rowName, { textAlign }]} numberOfLines={1}>
                    {isAr ? w.name_ar : w.name_fr}
                  </Text>
                  {feeLabel ? (
                    <Text style={[styles.rowSub, { textAlign }]} numberOfLines={1}>
                      {feeLabel}
                      {zone && zone.eta_days_min != null && zone.eta_days_max != null
                        ? ` • ${t('geo.eta_range', { min: zone.eta_days_min, max: zone.eta_days_max })}`
                        : ''}
                    </Text>
                  ) : null}
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={20} color={Brand.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={Brand.textMuted} />
                )}
              </Pressable>
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.06)',
  },
  title: { fontSize: 18, fontWeight: '900', color: Brand.text, letterSpacing: -0.3 },
  searchWrap: {
    margin: Spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchIcon: { width: 18 },
  searchInput: { flex: 1, height: 36, color: Brand.text, fontSize: 14, fontWeight: '600' },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  regionHeader: {
    fontSize: 11, fontWeight: '900', color: Brand.primary,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: Spacing.md, marginBottom: 6,
  },
  row: {
    backgroundColor: '#FFF',
    borderRadius: Radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.05)',
  },
  rowSelected: { borderColor: Brand.primary, backgroundColor: '#F4F8FE' },
  rowMain: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '800', color: Brand.text, letterSpacing: -0.1 },
  rowSub: { fontSize: 11, color: Brand.textMuted, fontWeight: '600', marginTop: 2 },
  codePill: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  codePillText: { fontSize: 12, fontWeight: '900', color: Brand.secondary, letterSpacing: 0.4 },
  empty: {
    color: Brand.textMuted, fontStyle: 'italic',
    paddingVertical: Spacing.xl,
  },
});

export default WilayaPickerModal;
