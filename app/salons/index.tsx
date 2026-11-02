import { useRouter } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native"

import { SalonsFilterSheet } from "@/components/salon/SalonsFilterSheet"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { SalonCard } from "@/components/ui/SalonCard"
import { SkeletonBone } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import type { Salon } from "@/data/types"
import {
  DEFAULT_EXPLORE_FILTERS,
  EXPLORE_PRICE_FILTERS,
  EXPLORE_RATING_FILTERS,
  EXPLORE_SORT_FILTERS,
  countActiveExploreFilters,
  filterExploreSalons,
  sortExploreSalons,
  type ExploreFilterState,
} from "@/lib/explore-filters"
import { salonsInSelectedLocation } from "@/lib/explore-location"
import { fetchSalons, getCatalogSnapshot } from "@/lib/salons-api"
import { getSavedLocation, type SavedLocation } from "@/lib/user"
import { colors, radii, shadows, spacing } from "@/theme/tokens"

function FilterPill({
  label,
  selected,
  onPress,
  onClear,
}: {
  label: string
  selected?: boolean
  onPress: () => void
  onClear?: () => void
}) {
  return (
    <View style={[styles.pill, selected && styles.pillOn]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: Boolean(selected) }}
        style={styles.pillMain}
      >
        <Text
          variant="caption"
          color={selected ? colors.primary : colors.text}
          style={{ fontFamily: selected ? "Geist_600SemiBold" : "Geist_500Medium" }}
        >
          {label}
        </Text>
        {!selected || !onClear ? (
          <Icon name="chevron-down" size={14} color={selected ? colors.primary : colors.textMuted} />
        ) : null}
      </Pressable>
      {selected && onClear ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClear}
          hitSlop={8}
          accessibilityLabel={`Clear ${label}`}
          style={styles.pillClear}
        >
          <Icon name="close" size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  )
}

/** Every salon near the chosen location. Same layout as the artists list. */
export default function SalonsScreen() {
  const router = useRouter()
  const [catalog, setCatalog] = useState<Salon[] | null>(() => {
    const cached = getCatalogSnapshot()
    return cached.length > 0 ? cached : null
  })
  const [location, setLocation] = useState<SavedLocation | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [filters, setFilters] = useState<ExploreFilterState>(DEFAULT_EXPLORE_FILTERS)
  const [draft, setDraft] = useState<ExploreFilterState>(DEFAULT_EXPLORE_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let active = true
    void getSavedLocation()
      .then((saved) => {
        if (active) setLocation(saved)
      })
      .catch(() => {})
    fetchSalons()
      .then(({ salons }) => {
        if (active) setCatalog(salons)
      })
      .catch(() => {
        if (active) {
          setLoadFailed(true)
          setCatalog((current) => current ?? [])
        }
      })
    return () => {
      active = false
    }
  }, [])

  const hasPin = location?.latitude !== undefined && location?.longitude !== undefined
  const nearby = useMemo(() => salonsInSelectedLocation(catalog ?? [], location, "nearby"), [catalog, location])
  const salons = useMemo(
    () => sortExploreSalons(filterExploreSalons(nearby, filters, { query: search }), filters.sort),
    [filters, nearby, search],
  )

  const sortActive = filters.sort !== "recommended"
  const activeFilterCount = countActiveExploreFilters(filters) + (sortActive ? 1 : 0)
  const priceLabel = EXPLORE_PRICE_FILTERS.find((o) => o.id === filters.price)?.label ?? "Price"
  const ratingLabel = EXPLORE_RATING_FILTERS.find((o) => o.id === filters.rating)?.label ?? "Rating"
  const sortLabel = EXPLORE_SORT_FILTERS.find((o) => o.id === filters.sort)?.label ?? "Sort"

  function openFilters() {
    setDraft(filters)
    setFilterOpen(true)
  }

  function clearFilters() {
    setDraft(DEFAULT_EXPLORE_FILTERS)
    setFilters(DEFAULT_EXPLORE_FILTERS)
    setFilterOpen(false)
  }

  const header = (
    <View style={styles.header}>
      <Text variant="body" muted>
        {location?.label ? `Near ${location.label}` : "Salons and spas near you."}
      </Text>

      <View style={styles.search}>
        <Icon name="search-outline" size={18} color={colors.textSubtle} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, area or service"
          accessibilityLabel="Search salons"
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {search ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch("")} hitSlop={8}>
            <Icon name="close-circle" size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
        <Pressable
          onPress={openFilters}
          accessibilityRole="button"
          accessibilityLabel="Open filters"
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnOn]}
        >
          <Icon name="options-outline" size={18} color={activeFilterCount > 0 ? colors.primary : colors.text} />
          <Text
            variant="caption"
            color={activeFilterCount > 0 ? colors.primary : colors.text}
            style={{ fontFamily: "Geist_600SemiBold" }}
          >
            Filters
          </Text>
          {activeFilterCount > 0 ? (
            <View style={styles.badge}>
              <Text variant="caption" color={colors.primaryFg} style={styles.badgeText}>
                {activeFilterCount}
              </Text>
            </View>
          ) : null}
        </Pressable>

        <FilterPill
          label={filters.category === "all" ? "Type" : filters.category}
          selected={filters.category !== "all"}
          onPress={openFilters}
          onClear={filters.category !== "all" ? () => setFilters((prev) => ({ ...prev, category: "all" })) : undefined}
        />
        <FilterPill
          label={filters.price === "any" ? "Price" : priceLabel}
          selected={filters.price !== "any"}
          onPress={openFilters}
          onClear={filters.price !== "any" ? () => setFilters((prev) => ({ ...prev, price: "any" })) : undefined}
        />
        <FilterPill
          label={filters.rating === "any" ? "Rating" : ratingLabel}
          selected={filters.rating !== "any"}
          onPress={openFilters}
          onClear={filters.rating !== "any" ? () => setFilters((prev) => ({ ...prev, rating: "any" })) : undefined}
        />
        <FilterPill
          label={sortLabel}
          selected={sortActive}
          onPress={openFilters}
          onClear={sortActive ? () => setFilters((prev) => ({ ...prev, sort: "recommended" })) : undefined}
        />
      </ScrollView>
    </View>
  )

  const skeleton = (
    <View style={{ gap: spacing.md }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.gridRow}>
          <SkeletonBone height={168} radius={radii.lg} style={styles.gridCell} />
          <SkeletonBone height={168} radius={radii.lg} style={styles.gridCell} />
        </View>
      ))}
    </View>
  )

  return (
    <>
      <FlatList
        style={styles.root}
        contentContainerStyle={styles.list}
        data={salons}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.gridCell}>
            <SalonCard
              salon={item}
              layout="carousel"
              onPress={() => router.push({ pathname: "/salon/[id]", params: { id: item.id } })}
            />
          </View>
        )}
        ListEmptyComponent={
          catalog === null || location === null ? (
            skeleton
          ) : (
            <View style={styles.emptyList}>
              <Text variant="heading" style={{ textAlign: "center" }}>
                {loadFailed
                  ? "Couldn't load salons"
                  : nearby.length === 0
                    ? `No salons in ${location.label}`
                    : "No salons match"}
              </Text>
              <Text variant="body" muted style={{ textAlign: "center" }}>
                {loadFailed
                  ? "Check your connection and try again."
                  : nearby.length === 0
                    ? "Try another location from Home."
                    : "Try clearing filters or searching something else."}
              </Text>
              {activeFilterCount > 0 && !loadFailed ? (
                <Button label="Clear all filters" variant="secondary" onPress={clearFilters} style={styles.clearBtn} />
              ) : null}
            </View>
          )
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      <SalonsFilterSheet
        visible={filterOpen}
        draft={draft}
        hasPin={hasPin}
        onChange={setDraft}
        onClose={() => setFilterOpen(false)}
        onApply={() => {
          setFilters(draft)
          setFilterOpen(false)
        }}
        onClear={clearFilters}
      />
    </>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  gridRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridCell: {
    flex: 1,
  },
  header: { gap: spacing.md, marginBottom: spacing.lg },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Geist_400Regular",
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
  },
  pillRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
    alignItems: "center",
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  filterBtnOn: {
    backgroundColor: "#F1F1F1",
    borderColor: colors.primary,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Geist_600SemiBold",
    lineHeight: 14,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: "hidden",
  },
  pillOn: {
    backgroundColor: "#F1F1F1",
    borderColor: colors.primary,
  },
  pillMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
  },
  pillClear: {
    paddingRight: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyList: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  clearBtn: {
    marginTop: spacing.sm,
  },
})
