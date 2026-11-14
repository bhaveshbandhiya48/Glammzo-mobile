import { Pressable, StyleSheet, View } from "react-native"

import { bk } from "@/components/book/BookingUi"
import { ui } from "@/components/salon-page/theme"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

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

function parts(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  return {
    top: diff === 0 ? "Today" : diff === 1 ? "Tmrw" : date.toLocaleDateString("en-IN", { weekday: "short" }),
    day: String(date.getDate()),
    month: date.toLocaleDateString("en-IN", { month: "short" }),
  }
}

/** Grid of day tiles: weekday (or Today / Tmrw), date, month. */
export function BookingDateSheet({ visible, options, value, onClose, onSelect }: Props) {
  return (
    <BottomSheet visible={visible} title="Pick a day" onClose={onClose}>
      <View style={styles.body}>
        {options.length === 0 ? (
          <Text style={styles.empty}>No dates available for this booking yet.</Text>
        ) : (
          <View style={styles.grid} accessibilityRole="radiogroup">
            {options.map((option) => {
              const active = option.date === value && !option.disabled
              const p = parts(option.date)
              return (
                <Pressable
                  key={option.date}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label}${option.disabled ? ", unavailable" : ""}`}
                  accessibilityState={{ selected: active, disabled: !!option.disabled }}
                  disabled={option.disabled}
                  onPress={() => {
                    if (option.disabled) return
                    onSelect(option.date)
                    onClose()
                  }}
                  style={({ pressed }) => [
                    styles.day,
                    active && styles.dayActive,
                    option.disabled && styles.dayDisabled,
                    pressed && !active && ui.pressed,
                  ]}
                >
                  {p ? (
                    <>
                      <Text style={[styles.top, active && styles.onDark]}>{p.top}</Text>
                      <Text style={[styles.num, active && styles.onDark, option.disabled && styles.strike]}>
                        {p.day}
                      </Text>
                      <Text style={[styles.month, active && styles.onDark]}>{p.month}</Text>
                    </>
                  ) : (
                    <Text style={[styles.top, active && styles.onDark]}>{option.label}</Text>
                  )}
                </Pressable>
              )
            })}
          </View>
        )}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { paddingBottom: 16 },
  empty: {
    textAlign: "center",
    paddingVertical: 28,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: bk.secondary,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  day: {
    width: "23.5%",
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: bk.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  dayActive: { backgroundColor: bk.text, borderColor: bk.text },
  dayDisabled: { backgroundColor: "#f7f7f7", borderColor: "#efefef" },
  top: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 14, color: bk.secondary },
  num: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, color: bk.text },
  month: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 14, color: bk.secondary },
  onDark: { color: "#ffffff" },
  strike: { color: "#b5b5b5", textDecorationLine: "line-through" },
})
