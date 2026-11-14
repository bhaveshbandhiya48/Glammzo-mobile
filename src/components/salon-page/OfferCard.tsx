import type { ReactNode } from "react"
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import type { Pastel } from "@/components/profile/ProfileParts"
import { sp, ui } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

/**
 * Pastel offer card shared by the salon and artist pages: white icon square,
 * uppercase eyebrow, title, caption lines, then an optional code chip / footer.
 */
export function OfferCard({
  pastel,
  icon,
  glyph,
  eyebrow,
  badge,
  title,
  lines,
  footer,
  width,
  onPress,
  accessibilityLabel,
  style,
  ...a11y
}: {
  pastel: Pastel
  icon?: IconName
  /** Text glyph instead of an icon (e.g. "%"). */
  glyph?: string
  eyebrow: string
  badge?: string | null
  title: string
  lines?: (string | null | undefined)[]
  footer?: ReactNode
  width?: number
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  accessible?: boolean
  accessibilityActions?: { name: string; label?: string }[]
  onAccessibilityAction?: (event: { nativeEvent: { actionName: string } }) => void
}) {
  const shown = (lines ?? []).filter((line): line is string => Boolean(line?.trim()))
  const body = (
    <>
      <GradientFill colors={pastel.gradient} angle={150} radius={16} />
      <View style={styles.top}>
        <View style={styles.icon}>
          {glyph ? (
            <Text style={[styles.glyph, { color: pastel.ink }]}>{glyph}</Text>
          ) : (
            <Icon name={icon ?? "pricetag-outline"} size={18} color={pastel.ink} />
          )}
        </View>
        <Text style={[styles.eyebrow, { color: pastel.ink }]} numberOfLines={1}>
          {eyebrow}
        </Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {shown.map((line) => (
        <Text key={line} style={styles.line} numberOfLines={2}>
          {line}
        </Text>
      ))}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  )
  const cardStyle = [styles.card, width != null && { width }, style]
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [...cardStyle, pressed && ui.pressed]}
        {...a11y}
      >
        {body}
      </Pressable>
    )
  }
  return (
    <View style={cardStyle} accessibilityLabel={accessibilityLabel} {...a11y}>
      {body}
    </View>
  )
}

/** Carousel page dots: active is a black 16px bar. */
export function OfferDots({ count, index }: { count: number; index: number }) {
  if (count < 2) return null
  return (
    <View style={styles.dots} accessible accessibilityLabel={`Offer ${index + 1} of ${count}`}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    padding: 16,
    gap: 4,
    minHeight: 132,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 20,
  },
  eyebrow: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: sp.text,
  },
  badgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 14,
    color: "#ffffff",
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 21,
    color: sp.text,
  },
  line: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: sp.secondary,
  },
  footer: {
    marginTop: 8,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#d4d4d4",
  },
  dotActive: {
    width: 16,
    backgroundColor: sp.text,
  },
})
