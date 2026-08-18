import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker"
import { useMemo, useState } from "react"
import { Platform, Pressable, StyleSheet, View } from "react-native"

import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { colors, radii, spacing, typography } from "@/theme/tokens"

type Props = {
  label?: string
  value: string
  onChange: (value: string) => void
  error?: string | null
  placeholder?: string
}

function defaultDobDate() {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 25)
  date.setHours(12, 0, 0, 0)
  return date
}

function parseDob(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // Prefer YYYY-MM-DD to avoid timezone shifts from Date.parse.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2]) - 1
    const day = Number(match[3])
    const date = new Date(year, month, day, 12, 0, 0, 0)
    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date
    }
  }
  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return null
  const date = new Date(parsed)
  date.setHours(12, 0, 0, 0)
  return date
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDisplay(value: string): string {
  const date = parseDob(value)
  if (!date) return ""
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function DateOfBirthField({
  label = "Date of birth",
  value,
  onChange,
  error,
  placeholder = "Select date of birth",
}: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => parseDob(value) ?? defaultDobDate())
  const showError = Boolean(error?.trim())

  const bounds = useMemo(() => {
    const maximumDate = new Date()
    maximumDate.setHours(23, 59, 59, 999)
    const minimumDate = new Date()
    minimumDate.setFullYear(minimumDate.getFullYear() - 120)
    minimumDate.setHours(0, 0, 0, 0)
    return { maximumDate, minimumDate }
  }, [])

  function openPicker() {
    setDraft(parseDob(value) ?? defaultDobDate())
    setOpen(true)
  }

  function closePicker() {
    setOpen(false)
  }

  function commit(date: Date) {
    onChange(toIsoDate(date))
    closePicker()
  }

  function onPickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false)
      if (event.type === "dismissed" || !selected) return
      onChange(toIsoDate(selected))
      return
    }
    if (selected) setDraft(selected)
  }

  const display = formatDisplay(value)

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" muted>
          {label}
        </Text>
      ) : null}

      <View style={[styles.field, showError && styles.fieldError]}>
        <Pressable
          onPress={openPicker}
          style={({ pressed }) => [styles.fieldHit, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <Text
            variant="body"
            color={display ? colors.text : colors.textSubtle}
            style={styles.fieldText}
            numberOfLines={1}
          >
            {display || placeholder}
          </Text>
          <Icon name="calendar-outline" size={18} color={colors.textSubtle} />
        </Pressable>
        {value.trim() ? (
          <Pressable
            onPress={() => onChange("")}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear date of birth"
          >
            <Icon name="close-circle" size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>

      {showError ? (
        <Text variant="caption" color={colors.destructive}>
          {error}
        </Text>
      ) : null}

      {Platform.OS === "android" && open ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="default"
          maximumDate={bounds.maximumDate}
          minimumDate={bounds.minimumDate}
          onChange={onPickerChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <BottomSheet
          visible={open}
          title="Date of birth"
          onClose={closePicker}
          scroll={false}
          compact
          footer={
            <Button label="Done" onPress={() => commit(draft)} />
          }
        >
          <DateTimePicker
            value={draft}
            mode="date"
            display="spinner"
            themeVariant="light"
            maximumDate={bounds.maximumDate}
            minimumDate={bounds.minimumDate}
            onChange={onPickerChange}
            style={styles.iosPicker}
          />
        </BottomSheet>
      ) : null}
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
  fieldHit: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  fieldError: {
    borderColor: colors.destructive,
  },
  fieldText: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
  },
  pressed: {
    opacity: 0.9,
  },
  iosPicker: {
    alignSelf: "stretch",
    height: 216,
  },
})
