import { StyleSheet, View } from "react-native"

import { FilterOptionChip, FilterSection, FilterSheetFooter, SheetRadioRow } from "@/components/list/SeeAllParts"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Text } from "@/components/ui/Text"
import {
  EXPLORE_CATEGORY_FILTERS,
  EXPLORE_PRICE_FILTERS,
  EXPLORE_RADIUS_FILTERS,
  EXPLORE_RATING_FILTERS,
  EXPLORE_SORT_FILTERS,
  type ExploreFilterState,
} from "@/lib/explore-filters"

type Props = {
  visible: boolean
  draft: ExploreFilterState
  hasPin: boolean
  onChange: (next: ExploreFilterState) => void
  onClose: () => void
  onApply: () => void
  onClear: () => void
}

/** Same sheet as the artists list, with the salon filters. */
export function SalonsFilterSheet({ visible, draft, hasPin, onChange, onClose, onApply, onClear }: Props) {
  const sortOptions = EXPLORE_SORT_FILTERS.filter((option) => option.id !== "nearest" || hasPin)
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
        <FilterSection title="Type">
          {EXPLORE_CATEGORY_FILTERS.map((option) => (
            <FilterOptionChip
              key={option.id}
              label={option.label}
              selected={draft.category === option.id}
              onPress={() => onChange({ ...draft, category: option.id })}
            />
          ))}
        </FilterSection>

        <FilterSection title="Availability">
          <FilterOptionChip
            label="Any time"
            selected={!draft.openOnly}
            onPress={() => onChange({ ...draft, openOnly: false })}
          />
          <FilterOptionChip
            label="Open now"
            selected={draft.openOnly}
            onPress={() => onChange({ ...draft, openOnly: true })}
          />
        </FilterSection>

        <FilterSection title="Price">
          {EXPLORE_PRICE_FILTERS.map((option) => (
            <FilterOptionChip
              key={option.id}
              label={option.label}
              selected={draft.price === option.id}
              onPress={() => onChange({ ...draft, price: option.id })}
            />
          ))}
        </FilterSection>

        <FilterSection title="Rating">
          {EXPLORE_RATING_FILTERS.map((option) => (
            <FilterOptionChip
              key={option.id}
              label={option.label}
              selected={draft.rating === option.id}
              onPress={() => onChange({ ...draft, rating: option.id })}
            />
          ))}
        </FilterSection>

        {hasPin ? (
          <FilterSection title="Distance">
            {EXPLORE_RADIUS_FILTERS.map((option) => (
              <FilterOptionChip
                key={option.id}
                label={option.label}
                selected={draft.radius === option.id}
                onPress={() => onChange({ ...draft, radius: option.id })}
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
})
