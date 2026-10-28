import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Button } from "@/components/ui/Button"
import { Text } from "@/components/ui/Text"
import { colors, spacing } from "@/theme/tokens"

type Props = {
  title: string
  subtitle?: string
  label: string
  onPress: () => void
  disabled?: boolean
  error?: string | null
  /** Lift above the keyboard when open. */
  bottomOffset?: number
}

export function StickyCta({
  title,
  subtitle,
  label,
  onPress,
  disabled,
  error,
  bottomOffset = 0,
}: Props) {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.bar,
        {
          bottom: bottomOffset,
          paddingBottom: Math.max(insets.bottom, spacing.md),
        },
      ]}
    >
      {error ? (
        <Text variant="caption" color={colors.primary} style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text variant="bodyStrong">{title}</Text>
          {subtitle ? (
            <Text variant="caption" muted>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Button label={label} onPress={onPress} disabled={disabled} style={styles.btn} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.chrome,
  },
  error: {
    textAlign: "left",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  btn: {
    minWidth: 132,
    paddingHorizontal: spacing.lg,
  },
})
