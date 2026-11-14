import { Pressable, StyleSheet, View } from "react-native"

import { bk } from "@/components/book/BookingUi"
import { ui } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

type Props = {
  label: string
  value: string
  placeholder: string
  icon: IconName
  disabled?: boolean
  onPress: () => void
}

/** Select-style field (52 tall, radius 14, #fafafa) that opens a picker sheet. */
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
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${empty ? placeholder : value}`}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [styles.trigger, disabled && styles.triggerDisabled, pressed && ui.pressed]}
      >
        <Icon name={icon} size={18} color={empty || disabled ? bk.muted : bk.text} />
        <Text
          numberOfLines={1}
          style={[styles.value, (empty || disabled) && styles.placeholder]}
        >
          {empty ? placeholder : value}
        </Text>
        <Icon name="chevron-down" size={16} color={bk.muted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 17, color: bk.text },
  trigger: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: bk.border,
    backgroundColor: bk.inputBg,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  triggerDisabled: { opacity: 0.5 },
  value: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 20, color: bk.text },
  placeholder: { color: bk.muted, fontFamily: fontFamily.regular },
})
