import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { colors, spacing } from "@/theme/tokens"

/** One heading style for every section on salon and artist pages. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  first = false,
  style,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
  /** First section after the intro: less space above. */
  first?: boolean
  /** Pages that space sections with `gap` pass `inline` to drop the outer margins. */
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.row, first && styles.first, style]}>
      <Text variant="heading" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${title}`}
          onPress={onAction}
          hitSlop={8}
          style={styles.action}
        >
          <Text variant="caption" style={styles.actionText}>
            {actionLabel}
          </Text>
          <Icon name="arrow-forward" size={14} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  )
}

export const sectionHeaderInline = { marginTop: 0, marginBottom: 0 } as const

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.xxxl,
    marginBottom: spacing.md,
  },
  first: {
    marginTop: spacing.xxl,
  },
  title: {
    flex: 1,
    fontSize: 20,
    letterSpacing: -0.4,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
  },
  actionText: {
    fontSize: 14,
    fontFamily: "Geist_600SemiBold",
  },
})
