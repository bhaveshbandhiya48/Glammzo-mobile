import { useLocalSearchParams, useNavigation, useRouter } from "expo-router"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  ArtistsFilterSheet,
  type ArtistsFilterDraft,
} from "@/components/artists/ArtistsFilterSheet"
import { ArtistListRow, ArtistListRowSkeleton } from "@/components/home/ArtistListRow"
import {
  SEE_ALL_EMPTY_COLORS,
  SeeAllChip,
  SeeAllChipRow,
  SeeAllClearLink,
  SeeAllEmpty,
  SeeAllHeader,
  SeeAllSearch,
} from "@/components/list/SeeAllParts"
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
import { NEARBY_RADIUS_KM } from "@/lib/explore-location"
import { getServiceTile } from "@/lib/service-tiles"
import { getSavedLocation, type SavedLocation } from "@/lib/user"
import { fontFamily } from "@/theme/tokens"

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

type Item =
  | { kind: "search" }
  | { kind: "chips" }
  | { kind: "note" }
  | { kind: "artist"; artist: ArtistCardData }
  | { kind: "skeleton"; id: number }
  | { kind: "empty" }

/** "Artists near you": solo artists near the saved location, as Home list rows, with paging. */
export default function ArtistsScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  // From Home (see `artistsSeeAllParams`): ?where=home|studio, ?sort=nearest, ?service=<tile key>.
  // ?audience is accepted too, but artists have no women / men data yet, so it doesn't filter.
  const params = useLocalSearchParams<{ where?: string; sort?: string; service?: string; audience?: string }>()
  const initialFilters = useMemo<ArtistsFilterDraft>(() => {
    const where = WHERE_OPTIONS.find((option) => option.id === params.where)?.id
    const sort = SORTS.find((option) => option.id === params.sort)?.id
    const category = getServiceTile(params.service ?? null)?.artistCategory ?? null
    return {
      ...DEFAULT_FILTERS,
      ...(where ? { where } : {}),
      ...(sort ? { sort } : {}),
      ...(category ? { category } : {}),
    }
    // Only the params the screen opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [catalog, setCatalog] = useState<{
    total: number
    categories: ArtistCategory[]
    occasions: ArtistOccasion[]
  } | null | undefined>(undefined)
  const [location, setLocation] = useState<SavedLocation | null>(null)
  const [filters, setFilters] = useState<ArtistsFilterDraft>(initialFilters)
  const [draft, setDraft] = useState<ArtistsFilterDraft>(initialFilters)
  const [filterOpen, setFilterOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [artists, setArtists] = useState<ArtistCardData[] | null>(null)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const requestRef = useRef(0)

  // This screen draws its own peach header.
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  const loadCatalog = useCallback(() => {
    setCatalog(undefined)
    void fetchArtistCategories().then(setCatalog)
  }, [])

  useEffect(() => {
    loadCatalog()
    void getSavedLocation()
      .then(setLocation)
      .catch(() => {})
  }, [loadCatalog])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const hasPin = location?.latitude !== undefined && location?.longitude !== undefined
  const labels = useMemo(
    () => Object.fromEntries((catalog?.categories ?? []).map((c) => [c.id, c.label])) as Record<string, string>,
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
      radiusKm: hasPin ? NEARBY_RADIUS_KM : undefined,
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
        setTotal(res.total)
        setHasMore(res.hasMore)
      })
      .catch(() => {
        if (id === requestRef.current) {
          setArtists([])
          setTotal(0)
          setError(true)
        }
      })
    return () => controller.abort()
  }, [catalog, query, reloadKey])

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

  const sortActive = filters.sort !== "recommended" && !(filters.sort === "nearest" && !hasPin)
  const activeFilterCount = [
    filters.category != null,
    filters.occasion != null,
    filters.where !== "any",
    sortActive,
  ].filter(Boolean).length

  const categoryLabel =
    filters.category != null
      ? (catalog?.categories.find((c) => c.id === filters.category)?.label ?? "Category")
      : null
  const occasionLabel =
    filters.occasion != null
      ? (visibleOccasions.find((o) => o.id === filters.occasion)?.label ?? "Occasion")
      : null
  const sortLabel = SORTS.find((s) => s.id === effectiveSort)?.label ?? "Sort"

  // Subtitle (same rules as Home "All near you", commit 53f1f19): with location off the API
  // returns recommended artists with no distances, so don't claim a radius.
  const loading = catalog === undefined || (catalog !== null && catalog.total > 0 && artists === null)
  const count = total || artists?.length || 0
  const noun = count === 1 ? "artist" : "artists"
  const hasDistances = (artists ?? []).some((artist) => artist.distanceKm != null)
  const city = location?.city?.trim()
  const subtitle = loading
    ? `Artists within ${NEARBY_RADIUS_KM} km`
    : hasDistances || (count === 0 && hasPin)
      ? `${count} ${noun} within ${NEARBY_RADIUS_KM} km`
      : city
        ? `${count} ${noun} in ${city}`
        : `${count} recommended ${noun}`

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/explore")
  }

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

  function toggleWhere(where: ArtistWhere) {
    setFilters((prev) => ({ ...prev, where: prev.where === where ? "any" : where }))
  }

  const data: Item[] = useMemo(() => {
    const head: Item[] = [{ kind: "search" }, { kind: "chips" }]
    if (filters.where === "home" && !hasPin) head.push({ kind: "note" })
    if (loading) return [...head, ...[0, 1, 2, 3].map((id) => ({ kind: "skeleton" as const, id }))]
    if (!artists || artists.length === 0 || catalog === null || catalog?.total === 0) {
      return [...head, { kind: "empty" }]
    }
    return [...head, ...artists.map((artist) => ({ kind: "artist" as const, artist }))]
  }, [artists, catalog, filters.where, hasPin, loading])

  function renderEmpty() {
    if (catalog === null || error) {
      return (
        <SeeAllEmpty
          icon="cloud-offline-outline"
          colors={SEE_ALL_EMPTY_COLORS.error}
          title="Couldn't load artists"
          body="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => (catalog === null ? loadCatalog() : setReloadKey((key) => key + 1))}
        />
      )
    }
    if (catalog?.total === 0) {
      return (
        <SeeAllEmpty
          icon="sparkles-outline"
          colors={SEE_ALL_EMPTY_COLORS.artists}
          title="No artists near you"
          body="Solo makeup, hair and mehendi artists will appear here. Check back shortly."
        />
      )
    }
    if (activeFilterCount > 0 || debounced.trim()) {
      return (
        <SeeAllEmpty
          icon="options-outline"
          colors={SEE_ALL_EMPTY_COLORS.artists}
          title="No artists match"
          body="Try clearing filters or searching something else."
          actionLabel="Clear filters"
          onAction={() => {
            clearFilters()
            setSearch("")
          }}
        />
      )
    }
    return (
      <SeeAllEmpty
        icon="person-outline"
        colors={SEE_ALL_EMPTY_COLORS.artists}
        title={`No artists near ${location?.label ?? "you"}`}
        body={`We show artists within ${NEARBY_RADIUS_KM} km. Try another location from Home.`}
      />
    )
  }

  function renderItem({ item }: { item: Item }) {
    switch (item.kind) {
      case "search":
        return <SeeAllSearch value={search} onChange={setSearch} label="Search artists" />
      case "chips":
        return (
          <SeeAllChipRow>
            <SeeAllChip
              icon="options-outline"
              label={activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : "Filters"}
              on={activeFilterCount > 0}
              onPress={openFilters}
              a11y="Open filters"
            />
            <SeeAllChip
              icon="swap-vertical-outline"
              label={sortLabel}
              on={sortActive}
              onPress={openFilters}
              a11y={`Sort: ${sortLabel}`}
              trailing="chevron-down"
            />
            {categoryLabel ? (
              <SeeAllChip
                label={categoryLabel}
                on
                onPress={() => setFilters((prev) => ({ ...prev, category: null }))}
                a11y={`${categoryLabel}. Tap to clear`}
                trailing="close"
              />
            ) : visibleCategories.length > 0 ? (
              <SeeAllChip label="Category" on={false} onPress={openFilters} trailing="chevron-down" />
            ) : null}
            <SeeAllChip
              icon="home-outline"
              label="At home"
              on={filters.where === "home"}
              onPress={() => toggleWhere("home")}
            />
            <SeeAllChip
              icon="storefront-outline"
              label="Studio"
              on={filters.where === "studio"}
              onPress={() => toggleWhere("studio")}
            />
            {occasionLabel ? (
              <SeeAllChip
                label={occasionLabel}
                on
                onPress={() => setFilters((prev) => ({ ...prev, occasion: null }))}
                a11y={`${occasionLabel}. Tap to clear`}
                trailing="close"
              />
            ) : null}
            {activeFilterCount > 0 ? <SeeAllClearLink onPress={clearFilters} /> : null}
          </SeeAllChipRow>
        )
      case "note":
        return (
          <Text style={styles.note}>
            Set your location on the Explore screen to see only artists who travel to you.
          </Text>
        )
      case "skeleton":
        return (
          <View style={styles.pad}>
            <ArtistListRowSkeleton />
          </View>
        )
      case "empty":
        return renderEmpty()
      case "artist":
        return (
          <View style={styles.pad}>
            <ArtistListRow artist={item.artist} labels={labels} />
          </View>
        )
    }
  }

  return (
    <View style={styles.root}>
      <SeeAllHeader title="Artists near you" subtitle={subtitle} onBack={goBack} />
      <FlatList
        style={styles.root}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        data={data}
        keyExtractor={(item) =>
          item.kind === "artist" ? item.artist.slug : item.kind === "skeleton" ? `skeleton-${item.id}` : item.kind
        }
        renderItem={renderItem}
        stickyHeaderIndices={[1]}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color="#111111" style={styles.more} /> : undefined
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffffff" },
  pad: { paddingHorizontal: 20 },
  note: {
    paddingHorizontal: 20,
    paddingTop: 10,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
  },
  more: { marginVertical: 20 },
})
