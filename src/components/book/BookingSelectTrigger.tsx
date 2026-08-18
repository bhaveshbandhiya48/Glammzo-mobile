import { Pressable, StyleSheet, View } from "react-native"

import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  label: string
  value: string
  placeholder: string
  icon: IconName
  disabled?: boolean
  onPress: () => void
}

/** Select-style trigger matching Glammzo-web DatePicker / TimeSlotPicker. */
export function BookingSelectTrigger({
  label,
  value,
  placeholder,
  icon,
  disabled = false,
  onPress,
}: Props) {
  const empty = !value.trim()

  return (
    <View style={styles.wrap}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={[styles.trigger, disabled && styles.triggerDisabled]}
      >
        <Text
          variant="body"
          numberOfLines={1}
          style={styles.value}
          color={empty || disabled ? colors.textSubtle : colors.text}
        >
          {empty ? placeholder : value}
        </Text>
        <Icon name={icon} size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  trigger: {
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  triggerDisabled: {
    opacity: 0.45,
  },
  value: {
    flex: 1,
  },
})
