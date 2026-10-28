import { Pressable, StyleSheet, View } from "react-native"

import { BottomSheet } from "@/components/ui/BottomSheet"
import { Text } from "@/components/ui/Text"
import { colors, radii, spacing } from "@/theme/tokens"

export type BookingDateOption = {
  date: string
  label: string
  disabled?: boolean
}

type Props = {
  visible: boolean
  options: BookingDateOption[]
  value: string | null
  onClose: () => void
  onSelect: (date: string) => void
}

export function BookingDateSheet({
  visible,
  options,
  value,
  onClose,
  onSelect,
}: Props) {
  return (
    <BottomSheet visible={visible} title="Select date" onClose={onClose}>
      <View style={styles.list}>
        {options.length === 0 ? (
          <Text muted style={styles.empty}>
            No dates available for this booking yet.
          </Text>
        ) : (
          options.map((option) => {
            const active = option.date === value && !option.disabled
            return (
              <Pressable
                accessibilityRole="button"
                key={option.date}
                disabled={option.disabled}
                onPress={() => {
                  if (option.disabled) return
                  onSelect(option.date)
                  onClose()
                }}
                style={[
                  styles.row,
                  active && styles.rowActive,
                  option.disabled && styles.rowDisabled,
                ]}
              >
                <Text
                  variant="bodyStrong"
                  color={
                    option.disabled
                      ? colors.textSubtle
                      : active
                        ? colors.primary
                        : colors.text
                  }
                >
                  {option.label}
                </Text>
                {option.disabled ? (
                  <Text variant="caption" muted>
                    Unavailable
                  </Text>
                ) : null}
              </Pressable>
            )
          })
        )}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  empty: {
    textAlign: "center",
    paddingVertical: spacing.xl,
  },
  row: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  rowActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}12`,
  },
  rowDisabled: {
    opacity: 0.45,
  },
})
