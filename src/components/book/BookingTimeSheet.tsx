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

type Part = "Morning" | "Afternoon" | "Evening"

/** "10:00 am" → "10:00 AM", so salon and artist times read the same. */
function displayLabel(label: string) {
  return label.replace(/\b(am|pm)\b/i, (m) => m.toUpperCase())
}

function partOfDay(label: string): Part {
  const m = label.match(/(\d{1,2})(?::\d{2})?\s*(am|pm)?/i)
  let hour = m ? Number(m[1]) : 9
  const suffix = m?.[2]?.toLowerCase()
  if (suffix === "pm" && hour < 12) hour += 12
  if (suffix === "am" && hour === 12) hour = 0
  return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"
}

/** Time slots grouped by part of day, with the earliest free time marked. */
export function BookingTimeSheet({
  visible,
  options,
  value,
  emptyMessage = "No time slots for this day.",
  onClose,
  onSelect,
  onClear,
}: Props) {
  const firstFree = options.find((slot) => !slot.disabled)?.value ?? null
  const groups = (["Morning", "Afternoon", "Evening"] as Part[])
    .map((part) => ({ part, slots: options.filter((slot) => partOfDay(slot.label) === part) }))
    .filter((group) => group.slots.length > 0)

  return (
    <BottomSheet visible={visible} title="Pick a time" onClose={onClose}>
      {options.length === 0 ? (
        <Text muted style={styles.empty}>
          {emptyMessage}
        </Text>
      ) : (
        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.part} style={styles.group}>
              <Text variant="label" muted>
                {group.part}
              </Text>
              <View style={styles.grid}>
                {group.slots.map((slot) => {
                  const active = value === slot.value && !slot.disabled
                  const earliest = slot.value === firstFree
                  const label = displayLabel(slot.label)
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${label}${earliest ? ", earliest available" : ""}${slot.disabled ? ", unavailable" : ""}`}
                      accessibilityState={{ selected: active, disabled: Boolean(slot.disabled) }}
                      key={slot.value}
                      disabled={slot.disabled}
                      onPress={() => {
                        if (slot.disabled) return
                        onSelect(slot.value)
                        onClose()
                      }}
                      style={({ pressed }) => [
                        styles.slot,
                        pressed && !active && styles.slotPressed,
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
                        {label}
                      </Text>
                      {earliest ? (
                        <Text variant="caption" style={styles.earliest} color={active ? colors.accent : colors.success}>
                          Earliest
                        </Text>
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ))}
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
  groups: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  group: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  slot: {
    width: "31%",
    flexGrow: 1,
    maxWidth: "32%",
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  slotPressed: {
    backgroundColor: colors.muted,
  },
  earliest: {
    fontSize: 10,
    lineHeight: 12,
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
