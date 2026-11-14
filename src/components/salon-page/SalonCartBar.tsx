import { Platform, Pressable, StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

export const CART_BAR_HEIGHT = 64
export const CART_BAR_GAP = 24

type Props = {
  bottomInset: number
  totalLabel: string
  compareLabel?: string | null
  itemCount: number
  firstItemName?: string
  onContinue: () => void
  onClear: () => void
}

/** Floating dark bag bar for the salon page. */
export function SalonCartBar({ bottomInset, totalLabel, compareLabel, itemCount, firstItemName, onContinue, onClear }: Props) {
  const itemWord = itemCount === 1 ? "item" : "items"
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: CART_BAR_GAP + bottomInset }]}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear bag"
          hitSlop={8}
          onPress={onClear}
          style={({ pressed }) => [styles.clear, pressed && { opacity: 0.8 }]}
        >
          <Icon name="close" size={16} color="#ffffff" />
        </Pressable>
        <View style={styles.copy}>
          <View style={styles.totals}>
            <Text style={styles.total}>{totalLabel}</Text>
            {compareLabel ? <Text style={styles.compare}>{compareLabel}</Text> : null}
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            {itemCount} {itemWord}
            {firstItemName ? ` · ${firstItemName}` : ""}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Continue to booking, ${itemCount} ${itemWord}, ${totalLabel}`}
          onPress={onContinue}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaText}>Continue →</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 25,
  },
  bar: {
    height: CART_BAR_HEIGHT,
    borderRadius: 22,
    backgroundColor: "#111111",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
    paddingRight: 8,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      default: { elevation: 10 },
    }),
  },
  clear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  totals: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  total: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 19,
    color: "#ffffff",
  },
  compare: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 17,
    color: "#a3a3a3",
    textDecorationLine: "line-through",
  },
  sub: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: "#d4d4d4",
  },
  cta: {
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    lineHeight: 18,
    color: "#111111",
  },
})
