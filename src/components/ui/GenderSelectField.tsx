import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { BottomSheet } from "@/components/ui/BottomSheet"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import {
  CONSUMER_GENDER_OPTIONS,
  genderLabel,
  type ConsumerGender,
} from "@/lib/user"
import { colors, radii, spacing, typography } from "@/theme/tokens"

type Props = {
  label?: string
  value: string
  /** When true, gender was already saved and cannot be changed. */
  locked?: boolean
  onChange: (value: ConsumerGender) => void
  error?: string | null
  placeholder?: string
}

export function GenderSelectField({
  label = "Gender",
  value,
  locked = false,
  onChange,
  error,
  placeholder = "Select gender",
}: Props) {
  const [open, setOpen] = useState(false)
  const showError = Boolean(error?.trim())
  const display = genderLabel(value)

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" muted>
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => {
          if (locked) return
          setOpen(true)
        }}
        disabled={locked}
        accessibilityRole="button"
        accessibilityState={{ disabled: locked }}
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.field,
          showError && styles.fieldError,
          locked && styles.fieldLocked,
          pressed && !locked && styles.pressed,
        ]}
      >
        <Text
          variant="body"
          color={display ? colors.text : colors.textSubtle}
          style={styles.fieldText}
          numberOfLines={1}
        >
          {display || placeholder}
        </Text>
        <Icon
          name={locked ? "lock-closed-outline" : "chevron-down"}
          size={18}
          color={colors.textSubtle}
        />
      </Pressable>

      {showError ? (
        <Text variant="caption" color={colors.destructive}>
          {error}
        </Text>
      ) : locked ? (
        <Text variant="caption" muted>
          Gender can’t be changed after it’s saved.
        </Text>
      ) : null}

      <BottomSheet
        visible={open}
        title="Select gender"
        onClose={() => setOpen(false)}
        compact
      >
        <View style={styles.list}>
          {CONSUMER_GENDER_OPTIONS.map((option) => {
            const active = value === option
            return (
              <Pressable
                key={option}
                onPress={() => {
                  onChange(option)
                  setOpen(false)
                }}
                style={[styles.row, active && styles.rowActive]}
              >
                <Text
                  variant="bodyStrong"
                  color={active ? colors.coral : colors.text}
                >
                  {genderLabel(option)}
                </Text>
                {active ? (
                  <Icon name="checkmark" size={18} color={colors.coral} />
                ) : null}
              </Pressable>
            )
          })}
        </View>
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  field: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  fieldError: {
    borderColor: colors.destructive,
  },
  fieldLocked: {
    opacity: 0.72,
    backgroundColor: colors.muted,
  },
  fieldText: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
  },
  pressed: {
    opacity: 0.9,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  row: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowActive: {
    borderColor: colors.coral,
    backgroundColor: "#FFF7F5",
  },
})
