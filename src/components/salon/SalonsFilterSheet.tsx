import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { Text } from "@/components/ui/Text"
import {
  EXPLORE_CATEGORY_FILTERS,
  EXPLORE_PRICE_FILTERS,
  EXPLORE_RADIUS_FILTERS,
  EXPLORE_RATING_FILTERS,
  EXPLORE_SORT_FILTERS,
  type ExploreFilterState,
} from "@/lib/explore-filters"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  visible: boolean
  draft: ExploreFilterState
  hasPin: boolean
  onChange: (next: ExploreFilterState) => void
  onClose: () => void
  onApply: () => void
  onClear: () => void
}

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text
        variant="caption"
        color={selected ? colors.primary : colors.text}
        style={{ fontFamily: selected ? "Geist_600SemiBold" : "Geist_500Medium" }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" muted>
        {title}
      </Text>
      <View style={styles.chipWrap}>{children}</View>
    </View>
  )
}

/** Same sheet as the artists list, with the salon filters. */
export function SalonsFilterSheet({ visible, draft, hasPin, onChange, onClose, onApply, onClear }: Props) {
  return (
    <BottomSheet
      visible={visible}
      title="Filters"
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Clear all" variant="secondary" onPress={onClear} style={styles.footerBtn} />
          <Button label="Apply" onPress={onApply} style={styles.footerBtn} />
        </View>
      }
    >
      <View style={styles.body}>
        <Section title="Type">
          {EXPLORE_CATEGORY_FILTERS.map((option) => (
            <OptionChip
              key={option.id}
              label={option.label}
              selected={draft.category === option.id}
              onPress={() => onChange({ ...draft, category: option.id })}
            />
          ))}
        </Section>

        <Section title="Availability">
          <OptionChip
            label="Any time"
            selected={!draft.openOnly}
            onPress={() => onChange({ ...draft, openOnly: false })}
          />
          <OptionChip
            label="Open now"
            selected={draft.openOnly}
            onPress={() => onChange({ ...draft, openOnly: true })}
          />
        </Section>

        <Section title="Price">
          {EXPLORE_PRICE_FILTERS.map((option) => (
            <OptionChip
              key={option.id}
              label={option.label}
              selected={draft.price === option.id}
              onPress={() => onChange({ ...draft, price: option.id })}
            />
          ))}
        </Section>

        <Section title="Rating">
          {EXPLORE_RATING_FILTERS.map((option) => (
            <OptionChip
              key={option.id}
              label={option.label}
              selected={draft.rating === option.id}
              onPress={() => onChange({ ...draft, rating: option.id })}
            />
          ))}
        </Section>

        {hasPin ? (
          <Section title="Distance">
            {EXPLORE_RADIUS_FILTERS.map((option) => (
              <OptionChip
                key={option.id}
                label={option.label}
                selected={draft.radius === option.id}
                onPress={() => onChange({ ...draft, radius: option.id })}
              />
            ))}
          </Section>
        ) : null}

        <Section title="Sort by">
          {EXPLORE_SORT_FILTERS.filter((option) => option.id !== "nearest" || hasPin).map((option) => (
            <OptionChip
              key={option.id}
              label={option.label}
              selected={draft.sort === option.id}
              onPress={() => onChange({ ...draft, sort: option.id })}
            />
          ))}
        </Section>
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.xl,
    paddingBottom: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: {
    backgroundColor: "#F1F1F1",
    borderColor: colors.primary,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.md,
  },
  footerBtn: {
    flex: 1,
  },
})
