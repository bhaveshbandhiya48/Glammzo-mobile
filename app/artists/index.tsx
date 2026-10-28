import { useRouter, type Href } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"

import {
  ArtistsFilterSheet,
  type ArtistsFilterDraft,
} from "@/components/artists/ArtistsFilterSheet"
import { ArtistCard } from "@/components/ui/ArtistCard"
import { Icon } from "@/components/ui/Icon"
import { SkeletonBone } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import {
  fetchArtistCategories,
  fetchArtists,
  type ArtistCardData,
  type ArtistCategory,
  type ArtistOccasion,
  type ArtistSort,
  type ArtistWhere,
} from "@/lib/artists-api"
import { getSavedLocation, type SavedLocation } from "@/lib/user"
import { colors, radii, spacing } from "@/theme/tokens"

const WHERE_OPTIONS: Array<{ id: ArtistWhere; label: string }> = [
  { id: "any", label: "Anywhere" },
  { id: "home", label: "At my place" },
  { id: "studio", label: "At studio" },
]

const SORTS: Array<{ id: ArtistSort; label: string }> = [
  { id: "recommended", label: "Recommended" },
  { id: "nearest", label: "Nearest" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
]

const DEFAULT_FILTERS: ArtistsFilterDraft = {
  category: null,
  occasion: null,
  where: "any",
  sort: "recommended",
}

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
          <Icon
            name="chevron-down"
            size={14}
            color={selected ? colors.primary : colors.textMuted}
          />
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

export default function ArtistsScreen() {
  const router = useRouter()
  const [catalog, setCatalog] = useState<{
    total: number
    categories: ArtistCategory[]
    occasions: ArtistOccasion[]
  } | null | undefined>(undefined)
  const [location, setLocation] = useState<SavedLocation | null>(null)
  const [filters, setFilters] = useState<ArtistsFilterDraft>(DEFAULT_FILTERS)
  const [draft, setDraft] = useState<ArtistsFilterDraft>(DEFAULT_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [artists, setArtists] = useState<ArtistCardData[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const requestRef = useRef(0)

  useEffect(() => {
    void fetchArtistCategories().then(setCatalog)
    void getSavedLocation()
      .then(setLocation)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const hasPin = location?.latitude !== undefined && location?.longitude !== undefined
  const labelOf = useCallback(
    (id: string) => catalog?.categories.find((c) => c.id === id)?.label ?? id,
    [catalog],
  )
  const effectiveSort: ArtistSort =
    filters.sort === "nearest" && !hasPin ? "recommended" : filters.sort

  const query = useMemo(
    () => ({
      category: filters.category,
      occasion: filters.occasion,
      where: filters.where,
      q: debounced,
      sort: effectiveSort,
      latitude: hasPin ? location!.latitude : undefined,
      longitude: hasPin ? location!.longitude : undefined,
    }),
    [filters, debounced, effectiveSort, hasPin, location],
  )

  useEffect(() => {
    if (!catalog) return
    const id = ++requestRef.current
    const controller = new AbortController()
    setArtists(null)
    setError(false)
    fetchArtists(query, controller.signal)
      .then((res) => {
        if (id !== requestRef.current) return
        setArtists(res.artists)
        setHasMore(res.hasMore)
      })
      .catch(() => {
        if (id === requestRef.current) {
          setArtists([])
          setError(true)
        }
      })
    return () => controller.abort()
  }, [catalog, query])

  async function loadMore() {
    if (!hasMore || loadingMore || !artists) return
    setLoadingMore(true)
    try {
      const res = await fetchArtists({ ...query, offset: artists.length })
      setArtists((prev) => [...(prev ?? []), ...res.artists])
      setHasMore(res.hasMore)
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  const visibleCategories = catalog?.categories.filter((c) => c.count > 0) ?? []
  const visibleOccasions = catalog?.occasions.filter((o) => o.count > 0) ?? []

  const activeFilterCount = [
    filters.category != null,
    filters.occasion != null,
    filters.where !== "any",
    filters.sort !== "recommended" && !(filters.sort === "nearest" && !hasPin),
  ].filter(Boolean).length

  const categoryLabel =
    filters.category != null
      ? (visibleCategories.find((c) => c.id === filters.category)?.label ?? "Category")
      : "Category"
  const whereLabel =
    WHERE_OPTIONS.find((o) => o.id === filters.where)?.label ?? "Location"
  const sortLabel = SORTS.find((s) => s.id === effectiveSort)?.label ?? "Sort"
  const occasionLabel =
    filters.occasion != null
      ? (visibleOccasions.find((o) => o.id === filters.occasion)?.label ?? "Occasion")
      : "Occasion"

  function openFilters() {
    setDraft(filters)
    setFilterOpen(true)
  }

  function applyFilters() {
    setFilters(draft)
    setFilterOpen(false)
  }

  function clearFilters() {
    setDraft(DEFAULT_FILTERS)
    setFilters(DEFAULT_FILTERS)
    setFilterOpen(false)
  }

  const header = (
    <View style={styles.header}>
      <View>
        <Text variant="title">Artists</Text>
        <Text variant="body" muted style={{ marginTop: 2 }}>
          Makeup, hair, mehendi and more. At your place or theirs.
        </Text>
      </View>

      <View style={styles.search}>
        <Icon name="search-outline" size={18} color={colors.textSubtle} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, area or service"
          accessibilityLabel="Search artists"
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {search ? (
          <Pressable accessibilityRole="button" onPress={() => setSearch("")} hitSlop={8}>
            <Icon name="close-circle" size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        <Pressable
          onPress={openFilters}
          accessibilityRole="button"
          accessibilityLabel="Open filters"
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnOn]}
        >
          <Icon
            name="options-outline"
            size={18}
            color={activeFilterCount > 0 ? colors.primary : colors.text}
          />
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
          label={categoryLabel}
          selected={filters.category != null}
          onPress={openFilters}
          onClear={
            filters.category != null
              ? () => setFilters((prev) => ({ ...prev, category: null }))
              : undefined
          }
        />
        <FilterPill
          label={whereLabel}
          selected={filters.where !== "any"}
          onPress={openFilters}
          onClear={
            filters.where !== "any"
              ? () => setFilters((prev) => ({ ...prev, where: "any" }))
              : undefined
          }
        />
        {visibleOccasions.length > 0 ? (
          <FilterPill
            label={occasionLabel}
            selected={filters.occasion != null}
            onPress={openFilters}
            onClear={
              filters.occasion != null
                ? () => setFilters((prev) => ({ ...prev, occasion: null }))
                : undefined
            }
          />
        ) : null}
        <FilterPill
          label={sortLabel}
          selected={effectiveSort !== "recommended"}
          onPress={openFilters}
          onClear={
            effectiveSort !== "recommended"
              ? () => setFilters((prev) => ({ ...prev, sort: "recommended" }))
              : undefined
          }
        />
      </ScrollView>

      {filters.where === "home" && !hasPin ? (
        <Text variant="caption" muted>
          Set your location on the Explore screen to see only artists who travel to you.
        </Text>
      ) : null}
    </View>
  )

  if (catalog === undefined) {
    return (
      <View style={[styles.root, { padding: spacing.lg, gap: spacing.md }]}>
        {[0, 1, 2].map((i) => (
          <SkeletonBone key={i} height={150} radius={radii.lg} />
        ))}
      </View>
    )
  }

  if (catalog === null || catalog.total === 0) {
    return (
      <View style={[styles.root, styles.empty]}>
        <Icon name="sparkles-outline" size={40} color={colors.primary} />
        <Text variant="heading" style={{ textAlign: "center" }}>
          Artists are coming soon
        </Text>
        <Text variant="body" muted style={{ textAlign: "center" }}>
          Solo makeup, hair and mehendi artists will appear here. Check back shortly.
        </Text>
      </View>
    )
  }

  return (
    <>
      <FlatList
        style={styles.root}
        contentContainerStyle={styles.list}
        data={artists ?? []}
        keyExtractor={(item) => item.slug}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => (
          <ArtistCard
            artist={item}
            categoryLabel={labelOf}
            onPress={() =>
              router.push({
                pathname: "/artist/[slug]",
                params: { slug: item.slug, name: item.displayName },
              } as Href)
            }
          />
        )}
        ListEmptyComponent={
          artists === null ? (
            <View style={{ gap: spacing.md }}>
              {[0, 1, 2].map((i) => (
                <SkeletonBone key={i} height={150} radius={radii.lg} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyList}>
              <Text variant="heading" style={{ textAlign: "center" }}>
                {error ? "Couldn't load artists" : "No artists match"}
              </Text>
              <Text variant="body" muted style={{ textAlign: "center" }}>
                {error
                  ? "Check your connection and try again."
                  : "Try clearing filters or searching something else."}
              </Text>
              {activeFilterCount > 0 && !error ? (
                <Pressable accessibilityRole="button" onPress={clearFilters} style={styles.clearLink}>
                  <Text variant="bodyStrong" color={colors.primary}>
                    Clear all filters
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : undefined
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      <ArtistsFilterSheet
        visible={filterOpen}
        draft={draft}
        categories={visibleCategories}
        occasions={visibleOccasions}
        sorts={SORTS}
        whereOptions={WHERE_OPTIONS}
        hasPin={hasPin}
        onChange={setDraft}
        onClose={() => setFilterOpen(false)}
        onApply={applyFilters}
        onClear={clearFilters}
      />
    </>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  header: { gap: spacing.md, marginBottom: spacing.lg },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    ...shadows(),
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
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyList: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  clearLink: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
})

function shadows() {
  return {
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  }
}
