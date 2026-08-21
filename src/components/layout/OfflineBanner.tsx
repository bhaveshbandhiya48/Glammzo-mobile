import { StatusBar } from "expo-status-bar"
import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useNetwork } from "@/context/NetworkContext"
import { colors, spacing } from "@/theme/tokens"

export function OfflineBanner() {
  const { isOffline } = useNetwork()
  const insets = useSafeAreaInsets()

  if (!isOffline) return null

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.bar, { paddingTop: Math.max(insets.top, spacing.sm) }]}
    >
      <StatusBar style="light" />
      <Icon name="cloud-offline-outline" size={16} color={colors.primaryFg} />
      <Text variant="caption" color={colors.primaryFg} style={styles.label}>
        You&apos;re offline
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.text,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
  },
})
