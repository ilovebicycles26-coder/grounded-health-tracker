import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { MobileSettingsProvider, useMobileSettings } from '../src/settings/MobileSettingsProvider';

function Navigation() {
  const { palette } = useMobileSettings();
  return (
    <>
      <StatusBar style="auto" />
      <Tabs
        screenOptions={{
          sceneStyle: { backgroundColor: palette.background },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          tabBarActiveTintColor: palette.action,
          tabBarInactiveTintColor: palette.textMuted,
          tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Today', tabBarLabel: 'Today' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
      </Tabs>
    </>
  );
}

export default function RootLayout() {
  return (
    <MobileSettingsProvider>
      <Navigation />
    </MobileSettingsProvider>
  );
}
