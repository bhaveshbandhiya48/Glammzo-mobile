import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { Text } from "@/components/ui/Text"
import type { ArtistCategory, ArtistOccasion, ArtistSort, ArtistWhere } from "@/lib/artists-api"
import { colors, radii, spacing } from "@/theme/tokens"

export type ArtistsFilterDraft = {
  category: string | null
  occasion: string | null
  where: ArtistWhere
  sort: ArtistSort
}

type Props = {
  visible: boolean
  draft: ArtistsFilterDraft
  categories: ArtistCategory[]
  occasions: ArtistOccasion[]
  sorts: Array<{ id: ArtistSort; label: string }>
  whereOptions: Array<{ id: ArtistWhere; label: string }>
  hasPin: boolean
  onChange: (next: ArtistsFilterDraft) => void
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
        color={selected ? colors.coral : colors.text}
        style={{ fontFamily: selected ? "Inter_600SemiBold" : "Inter_500Medium" }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <View style={styles.section}>
      <Text variant="label" muted>
        {title}
      </Text>
      <View style={styles.chipWrap}>{children}</View>
    </View>
  )
}

export function ArtistsFilterSheet({
  visible,
  draft,
  categories,
  occasions,
  sorts,
  whereOptions,
  hasPin,
  onChange,
  onClose,
  onApply,
  onClear,
}: Props) {
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
        <Section title="Category">
          <OptionChip
            label="All"
            selected={draft.category === null}
            onPress={() => onChange({ ...draft, category: null })}
          />
          {categories.map((c) => (
            <OptionChip
              key={c.id}
              label={`${c.label}${c.count > 0 ? ` (${c.count})` : ""}`}
              selected={draft.category === c.id}
              onPress={() =>
                onChange({
                  ...draft,
                  category: draft.category === c.id ? null : c.id,
                })
              }
            />
          ))}
        </Section>

        <Section title="Service location">
          {whereOptions.map((o) => (
            <OptionChip
              key={o.id}
              label={o.label}
              selected={draft.where === o.id}
              onPress={() => onChange({ ...draft, where: o.id })}
            />
          ))}
        </Section>
        {draft.where === "home" && !hasPin ? (
          <Text variant="caption" muted>
            Set your location on Explore to see artists who travel to you.
          </Text>
        ) : null}

        {occasions.length > 0 ? (
          <Section title="Occasion">
            <OptionChip
              label="Any"
              selected={draft.occasion === null}
              onPress={() => onChange({ ...draft, occasion: null })}
            />
            {occasions.map((o) => (
              <OptionChip
                key={o.id}
                label={o.label}
                selected={draft.occasion === o.id}
                onPress={() =>
                  onChange({
                    ...draft,
                    occasion: draft.occasion === o.id ? null : o.id,
                  })
                }
              />
            ))}
          </Section>
        ) : null}

        <Section title="Sort by">
          {sorts
            .filter((s) => s.id !== "nearest" || hasPin)
            .map((s) => (
              <OptionChip
                key={s.id}
                label={s.label}
                selected={draft.sort === s.id}
                onPress={() => onChange({ ...draft, sort: s.id })}
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
    backgroundColor: "#FEEDE9",
    borderColor: colors.coral,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.md,
  },
  footerBtn: {
    flex: 1,
  },
})
