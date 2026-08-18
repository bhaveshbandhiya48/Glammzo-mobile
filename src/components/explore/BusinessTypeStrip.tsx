import { Pressable, ScrollView, StyleSheet, View } from "react-native"

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

const TILE_COLORS = [
  "#FFE4DE", // coral wash
  "#E8E0D2", // sand
  "#DCEEE3", // mint
  "#EDE4D6", // warm beige
  "#F0DDDD", // soft rose
  "#DDE6F2", // soft blue
  "#E6DFF0", // soft lilac
]

export function BusinessTypeStrip({
  selected,
  onSelect,
  availableTypes,
}: Props) {
  const items =
    availableTypes && availableTypes.length > 0
      ? BUSINESS_TYPE_ITEMS.filter((item) => availableTypes.includes(item.label))
      : BUSINESS_TYPE_ITEMS

  return (
    <View>
      <Text variant="heading" style={styles.heading}>
        Browse by category
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="All categories"
          onPress={() => onSelect(null)}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: selected === null ? colors.coral : TILE_COLORS[0] },
            ]}
          >
            <Icon
              name="grid-outline"
              size={18}
              color={selected === null ? colors.primaryFg : colors.text}
            />
          </View>
          <Text variant="caption" numberOfLines={2} style={styles.label}>
            All
          </Text>
        </Pressable>

        {items.map((item, index) => {
          const active = selected === item.label
          return (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => onSelect(active ? null : item.label)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: active
                      ? colors.coral
                      : TILE_COLORS[(index + 1) % TILE_COLORS.length],
                  },
                ]}
              >
                <Icon
                  name={item.icon}
                  size={18}
                  color={active ? colors.primaryFg : colors.text}
                />
              </View>
              <Text variant="caption" numberOfLines={2} style={styles.label}>
                {item.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  heading: {
    marginBottom: spacing.md,
  },
  row: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  tile: {
    width: 64,
    alignItems: "center",
    gap: spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    textAlign: "center",
    minHeight: 32,
  },
  pressed: {
    opacity: 0.88,
  },
})
