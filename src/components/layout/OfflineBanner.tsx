import { Platform, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useNetwork } from "@/context/NetworkContext"
import { fontFamily } from "@/theme/tokens"

/** Floating black pill under the status bar while the phone is offline. */
export function OfflineBanner() {
  const { isOffline } = useNetwork()
  const insets = useSafeAreaInsets()

  if (!isOffline) return null

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.wrap, { top: Math.max(insets.top, 8) + 6 }]}
    >
      <View style={styles.pill}>
        <View style={styles.icon}>
          <Icon name="cloud-offline-outline" size={14} color="#111111" />
        </View>
        <Text style={styles.label}>You&apos;re offline</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingLeft: 6,
    paddingRight: 16,
    borderRadius: 999,
    backgroundColor: "#111111",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      default: { elevation: 8 },
    }),
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#d9ebfb",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: "#ffffff",
  },
})
