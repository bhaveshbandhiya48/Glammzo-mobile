import { Pressable, StyleSheet, View } from "react-native"

import { TimeGrid } from "@/components/book/BookingUi"
import { ui } from "@/components/salon-page/theme"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

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
  return (
    <BottomSheet visible={visible} title="Pick a time" onClose={onClose}>
      <View style={styles.body}>
        <TimeGrid
          options={options}
          value={value}
          emptyMessage={emptyMessage}
          onSelect={(next) => {
            onSelect(next)
            onClose()
          }}
        />
        {value && onClear ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onClear()
              onClose()
            }}
            style={({ pressed }) => [styles.clearBtn, pressed && ui.pressed]}
            hitSlop={8}
          >
            <Text style={styles.clearText}>Clear time</Text>
          </Pressable>
        ) : null}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingBottom: 16 },
  clearBtn: { alignSelf: "flex-start", paddingVertical: 6 },
  clearText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 17,
    color: "#595959",
    textDecorationLine: "underline",
  },
})
