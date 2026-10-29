import { Pressable, ScrollView, StyleSheet } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import {
  BUSINESS_TYPE_ITEMS,
  type BusinessType,
} from "@/data/business-types"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  selected: BusinessType | null
  onSelect: (type: BusinessType | null) => void
  /** When set, only these business types are shown (plus All). */
  availableTypes?: readonly BusinessType[]
}

export function BusinessTypeStrip({
  selected,
  onSelect,
  availableTypes,
}: Props) {
  const items = availableTypes
    ? BUSINESS_TYPE_ITEMS.filter((item) => availableTypes.includes(item.label))
    : BUSINESS_TYPE_ITEMS
  const chips = [{ label: "All", icon: "grid-outline" as const, value: null }, ...items.map((item) => ({ label: item.label, icon: item.icon, value: item.label }))]

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroller}
    >
      {chips.map((chip) => {
        const active = selected === chip.value
        return (
          <Pressable
            key={chip.label}
            accessibilityRole="button"
            accessibilityLabel={chip.value ? chip.label : "All categories"}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(chip.value === null ? null : active ? null : chip.value)}
            style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && !active && styles.pressed]}
          >
            <Icon name={chip.icon} size={16} color={active ? colors.primaryFg : colors.text} />
            <Text variant="caption" color={active ? colors.primaryFg : colors.text} style={styles.label}>
              {chip.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroller: {
    marginHorizontal: -spacing.lg,
  },
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inputBorder,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    fontSize: 14,
  },
  pressed: {
    backgroundColor: colors.muted,
  },
})
