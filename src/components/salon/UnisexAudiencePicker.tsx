import { Pressable, StyleSheet, View } from "react-native"

import { Text } from "@/components/ui/Text"
import {
  SERVICE_GENDER_AUDIENCE_LABELS,
  type ServiceGenderAudience,
} from "@/lib/gender-audience"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  value?: ServiceGenderAudience | null
  onSelect: (value: ServiceGenderAudience) => void
}

/** Men / Women switch for unisex salons: one compact segmented control. */
export function UnisexAudiencePicker({ value = null, onSelect }: Props) {
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel="Show services for">
      {(["men", "women"] as const).map((audience) => {
        const selected = value === audience
        return (
          <Pressable
            key={audience}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${SERVICE_GENDER_AUDIENCE_LABELS[audience]} services`}
            onPress={() => onSelect(audience)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text variant="bodyStrong" color={selected ? colors.primaryFg : colors.text}>
              {SERVICE_GENDER_AUDIENCE_LABELS[audience]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentSelected: {
    backgroundColor: colors.primary,
  },
})
