import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMobileSettings } from '../src/settings/MobileSettingsProvider';

export default function TodayScreen() {
  const { palette } = useMobileSettings();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flex: 1, padding: 24 }}>
        <Text
          accessibilityRole="header"
          style={{ color: palette.action, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}
        >
          YOUR DAY
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            color: palette.text,
            fontFamily: 'Georgia',
            fontSize: 44,
            lineHeight: 48,
            marginTop: 12,
          }}
        >
          Small choices. Lasting change.
        </Text>
        <Text style={{ color: palette.textMuted, fontSize: 16, lineHeight: 25, marginTop: 16 }}>
          Your responsive Grounded shell is ready for the independently tested health modules.
        </Text>
        <View
          accessibilityLabel="Sync status: saved on this device"
          style={{
            alignSelf: 'flex-start',
            backgroundColor: palette.surface,
            borderRadius: 999,
            marginTop: 18,
            paddingHorizontal: 12,
            paddingVertical: 7,
          }}
        >
          <Text style={{ color: palette.textMuted, fontSize: 13, fontWeight: '700' }}>
            Saved on this device
          </Text>
        </View>
        <View
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: 18,
            borderWidth: 1,
            marginTop: 32,
            padding: 24,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: palette.text, fontSize: 22, fontWeight: '600' }}
          >
            Your private space
          </Text>
          <Text style={{ color: palette.textMuted, fontSize: 16, lineHeight: 25, marginTop: 16 }}>
            No prototype health data is connected to the commercial rebuild.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
