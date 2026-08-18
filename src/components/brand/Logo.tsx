import { Pressable, StyleSheet, View } from "react-native"

import { BrandWordmark } from "@/components/brand/BrandWordmark"

type Props = {
  size?: "md" | "lg" | "xl"
  onPress?: () => void
  /** Kept for call-site compatibility; wordmark colors are fixed to brand. */
  inverse?: boolean
}

const sizeMap = {
  md: { width: 118, height: 39 },
  lg: { width: 156, height: 52 },
  xl: { width: 198, height: 66 },
} as const

export function Logo({ size = "md", onPress }: Props) {
  const dims = sizeMap[size]
  const mark = (
    <View style={styles.row} accessibilityRole="header">
      <BrandWordmark width={dims.width} height={dims.height} />
    </View>
  )

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Glammzo home">
        {mark}
      </Pressable>
    )
  }

  return mark
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
})
