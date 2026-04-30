/**
 * WhatsApp contact block — green CTA card. Only renders if a phone number
 * is configured in store_settings.whatsapp_number.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { getWhatsAppNumber, openWhatsApp } from '@/services/whatsapp';

export function WhatsAppContactBlock() {
  const { t } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    void (async () => setPhone(await getWhatsAppNumber()))();
  }, []);

  if (!phone) return null;

  return (
    <Pressable onPress={() => void openWhatsApp()} style={styles.wrap}>
      <View style={[styles.row, { flexDirection: rowDirection }]}>
        <View style={styles.iconBubble}>
          <Ionicons name="logo-whatsapp" size={26} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { textAlign }]}>{t('home.wa_block_title')}</Text>
          <Text style={[styles.sub, { textAlign }]}>{t('home.wa_block_sub')}</Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{t('home.wa_block_cta')}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    backgroundColor: '#0F4F32',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    shadowColor: '#0F4F32',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  row: { alignItems: 'center', gap: 12 },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#FFF', fontWeight: '900', fontSize: 15 },
  sub: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  cta: {
    backgroundColor: '#25D366',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },
});
