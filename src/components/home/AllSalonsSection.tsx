import { useMemo, type ReactNode } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"

import { SalonListRow } from "@/components/home/SalonListRow"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Salon } from "@/data/types"
import {
  countActiveExploreFilters,
  EXPLORE_SORT_FILTERS,
  sortExploreSalons,
  type ExploreFilterState,
} from "@/lib/explore-filters"
import { partitionSalonsByCurrentArea } from "@/lib/explore-location"
import { pickFeaturedSectionSalons, pickNearbyAfterFeatured } from "@/lib/featured-nearby"
import type { SavedLocation } from "@/lib/user"
import { fontFamily, spacing } from "@/theme/tokens"

const NEAR_LIMIT = 10
const NEARBY_AREAS_LIMIT = 5

type FilterChipsProps = {
  filters: ExploreFilterState
  onChange: (next: ExploreFilterState) => void
  onOpenFilters: () => void
  onOpenSort: () => void
  onClearAll: () => void
}

/** "Filters · N", sort, and quick toggles that write straight into the shared filter state. */
export function SalonFilterChips({ filters, onChange, onOpenFilters, onOpenSort, onClearAll }: FilterChipsProps) {
  const count = countActiveExploreFilters(filters)
  const sortLabel = EXPLORE_SORT_FILTERS.find((item) => item.id === filters.sort)?.label ?? "Recommended"
  const ratingOn = filters.rating !== "any"
  const priceOn = filters.price === "under-500"

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      directionalLockEnabled
      contentContainerStyle={styles.chips}
    >
      <Chip
        icon="options-outline"
        label={count > 0 ? `Filters · ${count}` : "Filters"}
        on={count > 0}
        onPress={onOpenFilters}
        a11y="Open filters"
      />
      <Chip
        icon="swap-vertical-outline"
        label={sortLabel}
        on={filters.sort !== "recommended"}
        onPress={onOpenSort}
        a11y={`Sort: ${sortLabel}`}
        trailing="chevron-down"
      />
      <Chip
        label="Open now"
        on={filters.openOnly}
        onPress={() => onChange({ ...filters, openOnly: !filters.openOnly })}
      />
      <Chip
        label="4.0+"
        on={ratingOn}
        onPress={() => onChange({ ...filters, rating: ratingOn ? "any" : "4" })}
        a11y="Rated 4.0 and up"
      />
      <Chip
        label="Under ₹500"
        on={priceOn}
        onPress={() => onChange({ ...filters, price: priceOn ? "any" : "under-500" })}
      />
      {count > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
          onPress={onClearAll}
          hitSlop={8}
          style={styles.clear}
        >
          <Text style={styles.clearText}>Clear all</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  )
}

function Chip({
  label,
  on,
  onPress,
  icon,
  trailing,
  a11y,
}: {
  label: string
  on: boolean
  onPress: () => void
  icon?: IconName
  trailing?: IconName
  a11y?: string
}) {
  const ink = on ? "#ffffff" : "#111111"
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && !on && styles.chipPressed]}
    >
      {icon ? <Icon name={icon} size={15} color={ink} /> : null}
      <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
        {label}
      </Text>
      {trailing ? <Icon name={trailing} size={14} color={ink} /> : null}
    </Pressable>
  )
}

type Props = FilterChipsProps & {
  /** Location-scoped salons with the current filters applied (not yet sorted). */
  salons: Salon[]
  location: SavedLocation | null
  areaLabel: string | null
  onOpenMap: () => void
  onSeeAll: () => void
  /** Shown in place of the list when the filters leave nothing. */
  emptyState?: ReactNode
}

/** Home "All salons near you": header + Map, filter chips, Featured-first rows, then nearby areas. */
export function AllSalonsSection({
  salons,
  location,
  areaLabel,
  onOpenMap,
  onSeeAll,
  emptyState,
  ...chipProps
}: Props) {
  const sort = chipProps.filters.sort
  const { featured, near, nearbyAreas } = useMemo(() => {
    const featuredSalons = pickFeaturedSectionSalons(salons).salons
    const rest = sortExploreSalons(pickNearbyAfterFeatured(salons, featuredSalons), sort)
    const { local, nearbyAreas: further } = partitionSalonsByCurrentArea(rest, location)
    return { featured: featuredSalons, near: local, nearbyAreas: further }
  }, [location, salons, sort])

  const total = salons.length
  const nearRows = [
    ...featured.map((salon) => ({ salon, featured: true })),
    ...near.map((salon) => ({ salon, featured: false })),
  ].slice(0, NEAR_LIMIT)
  const furtherRows = nearbyAreas.slice(0, NEARBY_AREAS_LIMIT)
  const subtitle = areaLabel ? `${total} in ${areaLabel} and nearby` : `${total} nearby`

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            All salons near you
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show salons on a map"
          onPress={onOpenMap}
          style={({ pressed }) => [styles.mapPill, pressed && styles.chipPressed]}
        >
          <Icon name="map-outline" size={16} color="#111111" />
          <Text style={styles.mapText}>Map</Text>
        </Pressable>
      </View>

      <SalonFilterChips {...chipProps} />

      {total === 0 ? (
        <View style={styles.pad}>{emptyState}</View>
      ) : (
        <View style={styles.pad}>
          {nearRows.map(({ salon, featured: isFeatured }) => (
            <SalonListRow key={salon.id} salon={salon} featured={isFeatured} />
          ))}

          {furtherRows.length > 0 ? (
            <>
              <View style={styles.divider} accessibilityRole="header">
                <View style={styles.line} />
                <Text style={styles.dividerText}>A LITTLE FURTHER · NEARBY AREAS</Text>
                <View style={styles.line} />
              </View>
              {furtherRows.map((salon) => (
                <SalonListRow key={salon.id} salon={salon} featured={salon.isFeatured === true} />
              ))}
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onSeeAll}
            style={({ pressed }) => [styles.seeAll, pressed && styles.chipPressed]}
          >
            <Text style={styles.seeAllText}>{`See all ${total} salons`}</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

/** Small "OFFERS FOR YOU" label above the promo banners. */
export function OffersLabel() {
  return (
    <View style={styles.offersLabel}>
      <Text style={styles.offersLabelText} accessibilityRole="header">
        OFFERS FOR YOU
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // The screen scroll pads 16; this section runs edge to edge with its own 20.
  section: {
    marginHorizontal: -spacing.lg,
    marginTop: 28,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: "#111111",
  },
  subtitle: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
  },
  mapPill: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: "#111111",
  },
  chips: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: "center",
    paddingBottom: 4,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipOn: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
  chipPressed: {
    backgroundColor: "#f6f6f6",
  },
  chipText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: "#111111",
  },
  chipTextOn: {
    color: "#ffffff",
  },
  clear: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  clearText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: "#111111",
    textDecorationLine: "underline",
  },
  pad: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
    marginBottom: 4,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#e8e8e8",
  },
  dividerText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    color: "#4b5563",
  },
  seeAll: {
    marginTop: 20,
    alignSelf: "center",
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    alignItems: "center",
    justifyContent: "center",
  },
  seeAllText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: "#111111",
  },
  offersLabel: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },
  offersLabelText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    color: "#4b5563",
  },
})
