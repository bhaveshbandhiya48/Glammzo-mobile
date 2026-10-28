import { Pressable, StyleSheet, View } from "react-native"

import { BottomSheet } from "@/components/ui/BottomSheet"
import { Text } from "@/components/ui/Text"
import { colors, radii, spacing } from "@/theme/tokens"

export type BookingTimeOption = {
  value: string
  label: string
  disabled?: boolean
}

type Props = {
  visible: boolean
  options: BookingTimeOption[]
  value: string | null
  emptyMessage?: string
  onClose: () => void
  onSelect: (value: string) => void
  onClear?: () => void
}

/** Time slots sheet — 2-column grid like Glammzo-web TimeSlotPicker. */
export function BookingTimeSheet({
  visible,
  options,
  value,
  emptyMessage = "No time slots for this day.",
  onClose,
  onSelect,
  onClear,
}: Props) {
  return (
    <BottomSheet visible={visible} title="Time slots" onClose={onClose}>
      {options.length === 0 ? (
        <Text muted style={styles.empty}>
          {emptyMessage}
        </Text>
      ) : (
        <View style={styles.grid}>
          {options.map((slot) => {
            const active = value === slot.value && !slot.disabled
            return (
              <Pressable
                accessibilityRole="button"
                key={slot.value}
                disabled={slot.disabled}
                onPress={() => {
                  if (slot.disabled) return
                  onSelect(slot.value)
                  onClose()
                }}
                style={[
                  styles.slot,
                  active && styles.slotActive,
                  slot.disabled && styles.slotDisabled,
                ]}
              >
                <Text
                  variant="caption"
                  style={slot.disabled ? styles.slotTextDisabled : undefined}
                  color={
                    slot.disabled
                      ? colors.textSubtle
                      : active
                        ? colors.primaryFg
                        : colors.text
                  }
                >
                  {slot.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}
      {value && onClear ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onClear()
            onClose()
          }}
          style={styles.clearBtn}
          hitSlop={8}
        >
          <Text variant="caption" muted>
            Clear
          </Text>
        </Pressable>
      ) : null}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  empty: {
    textAlign: "center",
    paddingVertical: spacing.xl,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  slot: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
    maxWidth: "48%",
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  slotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotDisabled: {
    borderStyle: "dashed",
    opacity: 0.5,
  },
  slotTextDisabled: {
    textDecorationLine: "line-through",
  },
  clearBtn: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
})
