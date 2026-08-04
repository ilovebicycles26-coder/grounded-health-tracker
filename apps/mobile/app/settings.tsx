import type { ThemePreference } from '@grounded/settings';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMobileSettings } from '../src/settings/MobileSettingsProvider';

const themes: readonly { readonly value: ThemePreference; readonly label: string }[] = [
  { value: 'system', label: 'Use system setting' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'high-contrast', label: 'High contrast' },
];

export default function SettingsScreen() {
  const { palette, settings, update } = useMobileSettings();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={{ color: palette.action, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>
          THIS DEVICE
        </Text>
        <Text
          accessibilityRole="header"
          style={{ color: palette.text, fontFamily: 'Georgia', fontSize: 34, marginTop: 8 }}
        >
          Appearance & comfort
        </Text>
        <Text style={{ color: palette.textMuted, fontSize: 15, lineHeight: 23, marginTop: 10 }}>
          These choices stay on this phone. Account units and privacy choices sync after mobile
          sign-in is delivered.
        </Text>
        <View
          accessibilityRole="radiogroup"
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: 18,
            borderWidth: 1,
            marginTop: 24,
            overflow: 'hidden',
          }}
        >
          {themes.map((theme) => {
            const selected = settings.theme === theme.value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={theme.value}
                onPress={() => void update({ ...settings, theme: theme.value })}
                style={{
                  borderBottomColor: palette.border,
                  borderBottomWidth: theme.value === 'high-contrast' ? 0 : 1,
                  padding: 18,
                }}
              >
                <Text
                  style={{
                    color: palette.text,
                    fontSize: 16,
                    fontWeight: selected ? '800' : '500',
                  }}
                >
                  {selected ? '✓ ' : ''}
                  {theme.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: 18,
            borderWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 16,
            padding: 18,
          }}
        >
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>
              Use less data
            </Text>
            <Text style={{ color: palette.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
              Future media and background sync will use less mobile data.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Use less data"
            onValueChange={(reducedData) => void update({ ...settings, reducedData })}
            value={settings.reducedData}
          />
        </View>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: 18,
            borderWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 16,
            padding: 18,
          }}
        >
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>
              Reduce motion
            </Text>
            <Text style={{ color: palette.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
              Turn off non-essential animation in addition to your phone setting.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Reduce motion"
            onValueChange={(reduce) =>
              void update({ ...settings, motion: reduce ? 'reduce' : 'system' })
            }
            value={settings.motion === 'reduce'}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
