import { StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"

/**
 * Soft rounded verified mark (circle + check) — no sharp square chip.
 */
export function ArtistVerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <View
      style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityLabel="Verified artist"
    >
      <Icon name="checkmark-circle" size={size} color="#2F80ED" />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
})
