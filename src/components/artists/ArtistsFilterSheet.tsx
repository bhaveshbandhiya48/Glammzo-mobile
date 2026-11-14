import { StyleSheet, View } from "react-native"

import { FilterOptionChip, FilterSection, FilterSheetFooter, SheetRadioRow } from "@/components/list/SeeAllParts"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Text } from "@/components/ui/Text"
import type { ArtistCategory, ArtistOccasion, ArtistSort, ArtistWhere } from "@/lib/artists-api"
import { fontFamily } from "@/theme/tokens"

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
  const sortOptions = sorts.filter((s) => s.id !== "nearest" || hasPin)
  return (
    <BottomSheet
      visible={visible}
      title="Filters"
      onClose={onClose}
      footer={
        <FilterSheetFooter onClear={onClear} onApply={onApply} />
      }
    >
      <View style={styles.body}>
        <FilterSection title="Category">
          <FilterOptionChip
            label="All"
            selected={draft.category === null}
            onPress={() => onChange({ ...draft, category: null })}
          />
          {categories.map((c) => (
            <FilterOptionChip
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
        </FilterSection>

        <FilterSection title="Service location">
          {whereOptions.map((o) => (
            <FilterOptionChip
              key={o.id}
              label={o.label}
              selected={draft.where === o.id}
              onPress={() => onChange({ ...draft, where: o.id })}
            />
          ))}
        </FilterSection>
        {draft.where === "home" && !hasPin ? (
          <Text style={styles.note}>Set your location on Explore to see artists who travel to you.</Text>
        ) : null}

        {occasions.length > 0 ? (
          <FilterSection title="Occasion">
            <FilterOptionChip
              label="Any"
              selected={draft.occasion === null}
              onPress={() => onChange({ ...draft, occasion: null })}
            />
            {occasions.map((o) => (
              <FilterOptionChip
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
          </FilterSection>
        ) : null}

        <FilterSection title="Sort by" wrap={false}>
          {sortOptions.map((option, index) => (
            <SheetRadioRow
              key={option.id}
              label={option.label}
              on={draft.sort === option.id}
              last={index === sortOptions.length - 1}
              onPress={() => onChange({ ...draft, sort: option.id })}
            />
          ))}
        </FilterSection>
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: {
    gap: 24,
    paddingBottom: 12,
  },
  note: {
    marginTop: -12,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
  },
})
