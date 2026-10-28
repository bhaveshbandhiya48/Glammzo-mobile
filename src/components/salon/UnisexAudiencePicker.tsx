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

export function UnisexAudiencePicker({ value = null, onSelect }: Props) {
  return (
    <View style={styles.wrap}>
      <Text variant="label" muted>
        Start here
      </Text>
      <Text variant="heading" style={styles.title}>
        Who are you booking for?
      </Text>
      <Text variant="caption" muted>
        This is a unisex salon. Choose men or women to see the matching services.
      </Text>
      <View style={styles.grid}>
        {(["men", "women"] as const).map((audience) => {
          const selected = value === audience
          return (
            <Pressable
              key={audience}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={SERVICE_GENDER_AUDIENCE_LABELS[audience]}
              onPress={() => onSelect(audience)}
              style={[styles.card, selected && styles.cardSelected]}
            >
              <Text variant="bodyStrong">
                {SERVICE_GENDER_AUDIENCE_LABELS[audience]}
              </Text>
              <Text variant="caption" muted>
                {audience === "men"
                  ? "Haircuts, beard, and grooming"
                  : "Hair, beauty, and bridal"}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    marginTop: 2,
  },
  grid: {
    marginTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    minHeight: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 4,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: "#F1F1F1",
  },
})
