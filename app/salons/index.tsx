import { useLocalSearchParams, useNavigation, useRouter } from "expo-router"
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import { FlatList, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ArtistListRowSkeleton } from "@/components/home/ArtistListRow"
import { SalonListRow } from "@/components/home/SalonListRow"
import {
  SEE_ALL_EMPTY_COLORS,
  SeeAllChip,
  SeeAllChipRow,
  SeeAllClearLink,
  SeeAllEmpty,
  SeeAllHeader,
  SeeAllSearch,
} from "@/components/list/SeeAllParts"
import { SalonsFilterSheet } from "@/components/salon/SalonsFilterSheet"
import type { Salon } from "@/data/types"
import {
  DEFAULT_EXPLORE_FILTERS,
  EXPLORE_SORT_FILTERS,
  countActiveExploreFilters,
  filterExploreSalons,
  sortExploreSalons,
  type ExploreFilterState,
} from "@/lib/explore-filters"
import { browseModeFor, currentAreaLabel, resolveExploreLocationSalons } from "@/lib/explore-location"
import { salonsForTile } from "@/lib/home-salon-info"
import { salonMatchesGenderAudience } from "@/lib/gender-audience"
import { fetchSalons, getCatalogSnapshot } from "@/lib/salons-api"
import { parseSalonsSeeAllParams } from "@/lib/see-all-params"
import { getServiceTile, type HomeAudience, type ServiceTileKey } from "@/lib/service-tiles"
import { getSavedLocation, type SavedLocation } from "@/lib/user"

type Item =
  | { kind: "search" }
  | { kind: "chips" }
  | { kind: "salon"; salon: Salon }
  | { kind: "skeleton"; id: number }
  | { kind: "empty" }

/**
 * "Salons near you": every salon near the chosen location, as Home list rows.
 * Opens with Home's filters when passed (see `salonsSeeAllParams`), and works with none.
 */
export default function SalonsScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<Record<string, string>>()
  // Only the params the screen opened with.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => parseSalonsSeeAllParams(params), [])

  const [catalog, setCatalog] = useState<Salon[] | null>(() => {
    const cached = getCatalogSnapshot()
    return cached.length > 0 ? cached : null
  })
  const [location, setLocation] = useState<SavedLocation | null>(null)
  const [locationReady, setLocationReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [filters, setFilters] = useState<ExploreFilterState>(initial.filters)
  const [draft, setDraft] = useState<ExploreFilterState>(initial.filters)
  const [service, setService] = useState<ServiceTileKey | null>(initial.service)
  const [audience, setAudience] = useState<HomeAudience | null>(initial.audience)
  const [filterOpen, setFilterOpen] = useState(false)
  const [search, setSearch] = useState("")

  // This screen draws its own peach header.
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  const load = useCallback(() => {
    let active = true
    setLoadFailed(false)
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

  useEffect(() => {
    let active = true
    void getSavedLocation()
      .then((saved) => {
        if (active) setLocation(saved)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLocationReady(true)
      })
    const stop = load()
    return () => {
      active = false
      stop()
    }
  }, [load])

  const hasPin = location?.latitude !== undefined && location?.longitude !== undefined
  // Same list Home shows (whole city for a city pick, 10 km and wider for an address), uncapped.
  const scoped = useMemo(() => {
    if (!location) return null
    const result = resolveExploreLocationSalons({
      catalog: catalog ?? [],
      location,
      mode: browseModeFor(location),
    })
    return result.emptyKind === "none" ? result : null
  }, [catalog, location])
  const nearby = useMemo(() => scoped?.salons ?? [], [scoped])
  const tile = service ? getServiceTile(service) : undefined
  const salons = useMemo(() => {
    // Audience narrows salons by who they serve, and a service pick by that service's tags.
    const forService = tile
      ? salonsForTile(nearby, tile, audience)
      : audience
        ? nearby.filter((salon) => salonMatchesGenderAudience(salon, audience))
        : nearby
    return sortExploreSalons(filterExploreSalons(forService, filters, { query: search }), filters.sort)
  }, [audience, filters, nearby, search, tile])

  const loading = catalog === null || !locationReady
  const filterCount = countActiveExploreFilters(filters)
  const sortActive = filters.sort !== "recommended"
  const anyActive = filterCount > 0 || sortActive || service !== null || search.trim().length > 0
  const sortLabel = EXPLORE_SORT_FILTERS.find((o) => o.id === filters.sort)?.label ?? "Recommended"
  const ratingOn = filters.rating !== "any"
  const priceOn = filters.price === "under-500"

  const area = location ? (currentAreaLabel(location) ?? location.label) : null
  const count = salons.length
  const subtitle = loading
    ? "Finding salons near you…"
    : `${count} ${count === 1 ? "salon" : "salons"}${area ? ` · ${area}` : ""}`

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/explore")
  }

  function openFilters() {
    setDraft(filters)
    setFilterOpen(true)
  }

  function clearFilters() {
    setDraft(DEFAULT_EXPLORE_FILTERS)
    setFilters(DEFAULT_EXPLORE_FILTERS)
    setService(null)
    setFilterOpen(false)
  }

  function clearEverything() {
    clearFilters()
    setSearch("")
  }

  const data: Item[] = useMemo(() => {
    const head: Item[] = [{ kind: "search" }, { kind: "chips" }]
    if (loading) return [...head, ...[0, 1, 2, 3].map((id) => ({ kind: "skeleton" as const, id }))]
    if (salons.length === 0) return [...head, { kind: "empty" }]
    return [...head, ...salons.map((salon) => ({ kind: "salon" as const, salon }))]
  }, [loading, salons])

  function renderEmpty() {
    if (loadFailed && nearby.length === 0) {
      return (
        <SeeAllEmpty
          icon="cloud-offline-outline"
          colors={SEE_ALL_EMPTY_COLORS.error}
          title="Couldn't load salons"
          body="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            setCatalog(null)
            load()
          }}
        />
      )
    }
    if (!location) {
      return (
        <SeeAllEmpty
          icon="location-outline"
          colors={SEE_ALL_EMPTY_COLORS.salons}
          title="Set your location"
          body="Pick a location on Home to see salons near you."
        />
      )
    }
    if (nearby.length === 0) {
      return (
        <SeeAllEmpty
          icon="business-outline"
          colors={SEE_ALL_EMPTY_COLORS.salons}
          title={`No salons in ${location.label}`}
          body="Try another location from Home."
        />
      )
    }
    return (
      <SeeAllEmpty
        icon="options-outline"
        colors={SEE_ALL_EMPTY_COLORS.salons}
        title="No salons match"
        body="Try clearing filters or searching something else."
        actionLabel={anyActive ? "Clear filters" : undefined}
        onAction={anyActive ? clearEverything : undefined}
      />
    )
  }

  function renderItem({ item }: { item: Item }) {
    switch (item.kind) {
      case "search":
        return <SeeAllSearch value={search} onChange={setSearch} label="Search salons" />
      case "chips":
        return (
          <SeeAllChipRow>
            <SeeAllChip
              icon="options-outline"
              label={filterCount > 0 ? `Filters · ${filterCount}` : "Filters"}
              on={filterCount > 0}
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
            {tile ? (
              <SeeAllChip
                label={tile.label}
                on
                onPress={() => setService(null)}
                a11y={`${tile.label}. Tap to clear`}
                trailing="close"
              />
            ) : null}
            {tile ? (
              <SeeAllChip
                icon="people-outline"
                label={audience === "men" ? "Men" : audience === "women" ? "Women" : "Everyone"}
                on={audience !== null}
                onPress={() => setAudience(audience === "women" ? "men" : audience === "men" ? null : "women")}
                a11y="For: tap to switch Women, Men or Everyone"
              />
            ) : null}
            <SeeAllChip
              label="Open now"
              on={filters.openOnly}
              onPress={() => setFilters({ ...filters, openOnly: !filters.openOnly })}
            />
            <SeeAllChip
              label="4.0+"
              on={ratingOn}
              onPress={() => setFilters({ ...filters, rating: ratingOn ? "any" : "4" })}
              a11y="Rated 4.0 and up"
            />
            <SeeAllChip
              label="Under ₹500"
              on={priceOn}
              onPress={() => setFilters({ ...filters, price: priceOn ? "any" : "under-500" })}
            />
            {filterCount > 0 || sortActive || service ? <SeeAllClearLink onPress={clearFilters} /> : null}
          </SeeAllChipRow>
        )
      case "skeleton":
        return (
          <View style={styles.pad}>
            <ArtistListRowSkeleton />
          </View>
        )
      case "empty":
        return renderEmpty()
      case "salon":
        return (
          <View style={styles.pad}>
            <SalonListRow salon={item.salon} featured={item.salon.isFeatured === true} />
          </View>
        )
    }
  }

  return (
    <View style={styles.root}>
      <SeeAllHeader title="Salons near you" subtitle={subtitle} onBack={goBack} />
      <FlatList
        style={styles.root}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        data={data}
        keyExtractor={(item) =>
          item.kind === "salon" ? item.salon.id : item.kind === "skeleton" ? `skeleton-${item.id}` : item.kind
        }
        renderItem={renderItem}
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffffff" },
  pad: { paddingHorizontal: 20 },
})
