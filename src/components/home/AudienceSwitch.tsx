import { Platform, Pressable, StyleSheet, View } from "react-native"

import { Text } from "@/components/ui/Text"
import type { HomeAudience } from "@/lib/service-tiles"
import { fontFamily } from "@/theme/tokens"

const OPTIONS: Array<{ id: HomeAudience; label: string }> = [
  { id: "women", label: "Women" },
  { id: "men", label: "Men" },
]

/** Compact Women/Men segmented control. */
export function AudienceSwitch({
  value,
  onChange,
}: {
  value: HomeAudience
  onChange: (next: HomeAudience) => void
}) {
  return (
    <View style={styles.track} accessibilityRole="radiogroup" accessibilityLabel="Show services for">
      {OPTIONS.map((option) => {
        const active = option.id === value
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
            accessibilityLabel={`Show services for ${option.label}`}
            onPress={() => onChange(option.id)}
            hitSlop={6}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: "#f3f1ef",
    borderRadius: 10,
    padding: 3,
  },
  pill: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: {
    backgroundColor: "#ffffff",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
      default: { elevation: 1 },
    }),
  },
  text: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: "#4b5563",
  },
  textActive: {
    color: "#111111",
  },
})
