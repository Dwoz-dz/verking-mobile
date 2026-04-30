import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FloatingTabBar } from '@/components/navigation/FloatingTabBar';
import { PromoFab } from '@/components/storefront/PromoFab';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          // Hide the default chrome — `tabBar` below renders the
          // floating glass pill that respects safe-area insets.
          tabBarStyle: { display: 'none' },
        }}
        tabBar={(props) => <FloatingTabBar {...props} />}
      >
        <Tabs.Screen name="index"   options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="explore" options={{ title: t('tabs.shop') }} />
        <Tabs.Screen name="orders"  options={{ title: t('tabs.orders') }} />
        <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
      </Tabs>
      <PromoFab />
    </View>
  );
}
