import { useRouter } from "expo-router"
import { useMemo, useState, type ReactNode } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"

import { ArtistListRow, ArtistListRowSkeleton, artistRating } from "@/components/home/ArtistListRow"
import { GradientFill } from "@/components/home/GradientFill"
import { SalonListRow } from "@/components/home/SalonListRow"
import { useNearbyArtists } from "@/components/home/useTopArtists"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Salon } from "@/data/types"
import type { ArtistCardData } from "@/lib/artists-api"
import {
  countActiveExploreFilters,
  EXPLORE_SORT_FILTERS,
  sortExploreSalons,
  type ExploreFilterState,
} from "@/lib/explore-filters"
import { NEARBY_RADIUS_KM, partitionSalonsByCurrentArea } from "@/lib/explore-location"
import { pickFeaturedSectionSalons, pickNearbyAfterFeatured } from "@/lib/featured-nearby"
import type { SavedLocation } from "@/lib/user"
import { fontFamily, spacing } from "@/theme/tokens"

const NEAR_LIMIT = 10
const NEARBY_AREAS_LIMIT = 5
const ARTIST_LIMIT = 10

export type AllNearMode = "salons" | "artists"

// Last Salons / Artists choice, kept for the app session (in memory only).
let lastMode: AllNearMode = "salons"

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

type ArtistChipState = {
  sort: "nearest" | "rating"
  home: boolean
  studio: boolean
  rated: boolean
}

const DEFAULT_ARTIST_CHIPS: ArtistChipState = {
  sort: "nearest",
  home: false,
  studio: false,
  rated: false,
}

function byDistance(a: ArtistCardData, b: ArtistCardData) {
  return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
}

function byRating(a: ArtistCardData, b: ArtistCardData) {
  return (
    (artistRating(b) ?? 0) - (artistRating(a) ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0) || byDistance(a, b)
  )
}

/** On-device filters over Home's nearby artists. */
function filterArtists(artists: ArtistCardData[], chips: ArtistChipState): ArtistCardData[] {
  const list = artists.filter(
    (artist) =>
      (!chips.home || artist.offersHomeVisits) &&
      (!chips.studio || artist.hasStudio) &&
      (!chips.rated || (artistRating(artist) ?? 0) >= 4),
  )
  return list.sort(chips.sort === "rating" ? byRating : byDistance)
}

/** Full-width "Salons | Artists" segmented switch. */
function ModeSwitch({ mode, onChange }: { mode: AllNearMode; onChange: (mode: AllNearMode) => void }) {
  return (
    <View style={styles.switchTrack} accessibilityRole="tablist">
      {(["salons", "artists"] as const).map((id) => {
        const on = mode === id
        return (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(id)}
            style={[styles.switchSegment, on && styles.switchSegmentOn]}
          >
            <Text style={[styles.switchText, on && styles.switchTextOn]}>{id === "salons" ? "Salons" : "Artists"}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function ArtistChips({
  chips,
  onChange,
  canSortByDistance,
}: {
  chips: ArtistChipState
  onChange: (next: ArtistChipState) => void
  /** False when the list has no distances (location off); the sort chip is hidden then. */
  canSortByDistance: boolean
}) {
  const sortLabel = chips.sort === "nearest" ? "Nearest" : "Top rated"
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      directionalLockEnabled
      contentContainerStyle={styles.chips}
    >
      {canSortByDistance ? (
        <Chip
          icon="swap-vertical-outline"
          label={`Sort: ${sortLabel}`}
          on={chips.sort !== "nearest"}
          onPress={() =>
            onChange({
              ...chips,
              sort: chips.sort === "nearest" ? "rating" : "nearest",
            })
          }
          a11y={`Sort: ${sortLabel}. Tap to switch`}
        />
      ) : null}
      <Chip label="At home" on={chips.home} onPress={() => onChange({ ...chips, home: !chips.home })} />
      <Chip label="Studio" on={chips.studio} onPress={() => onChange({ ...chips, studio: !chips.studio })} />
      <Chip
        label="4.0+"
        on={chips.rated}
        onPress={() => onChange({ ...chips, rated: !chips.rated })}
        a11y="Rated 4.0 and up"
      />
    </ScrollView>
  )
}

function ArtistsEmptyCard({ failed }: { failed: boolean }) {
  const title = "No artists near you yet"
  const subtitle = failed ? "Couldn't load artists. Pull down to try again." : "We're adding new artists every week."
  return (
    <View style={styles.empty} accessible accessibilityLabel={`${title}. ${subtitle}`}>
      <GradientFill colors={["#f7f2ff", "#e6dcff"]} angle={150} radius={20} />
      <View style={styles.emptyIcon}>
        <Icon name="person-outline" size={22} color="#111111" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  )
}

type Props = FilterChipsProps & {
  /** Location-scoped salons with the current filters applied (not yet sorted). */
  salons: Salon[]
  location: SavedLocation | null
  areaLabel: string | null
  /** Opens the map; in Artists mode it should start on artists only. */
  onOpenMap: (mode: AllNearMode) => void
  onSeeAll: () => void
  /** Shown in place of the list when the filters leave nothing. */
  emptyState?: ReactNode
}

/**
 * Home "All near you": header + Map, a Salons / Artists switch, then either the salon chips with
 * Featured-first rows and nearby areas, or artist chips over Home's nearby artists.
 */
export function AllSalonsSection({
  salons,
  location,
  areaLabel,
  onOpenMap,
  onSeeAll,
  emptyState,
  ...chipProps
}: Props) {
  const router = useRouter()
  const [mode, setModeState] = useState<AllNearMode>(lastMode)
  const [artistChips, setArtistChips] = useState<ArtistChipState>(DEFAULT_ARTIST_CHIPS)
  const nearbyArtists = useNearbyArtists()
  // With location off, Home falls back to the recommended query, which has no distances.
  const hasDistances = (nearbyArtists.artists ?? []).some((artist) => artist.distanceKm != null)
  const shownArtists = useMemo(
    () =>
      filterArtists(
        nearbyArtists.artists ?? [],
        hasDistances ? artistChips : { ...artistChips, sort: "rating" },
      ),
    [artistChips, hasDistances, nearbyArtists.artists],
  )

  function setMode(next: AllNearMode) {
    lastMode = next
    setModeState(next)
  }

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
  const salonSubtitle = areaLabel ? `${total} in ${areaLabel} and nearby` : `${total} nearby`
  const artistCount = shownArtists.length
  const artistNoun = artistCount === 1 ? "artist" : "artists"
  const city = location?.city?.trim()
  // An empty list can't show distances, so fall back to whether there is a pin.
  const hasPin = Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude)
  const artistSubtitle =
    nearbyArtists.status !== "ready"
      ? `Artists within ${NEARBY_RADIUS_KM} km`
      : hasDistances || (artistCount === 0 && hasPin)
        ? `${artistCount} ${artistNoun} within ${NEARBY_RADIUS_KM} km`
        : city
          ? `${artistCount} ${artistNoun} in ${city}`
          : `${artistCount} recommended ${artistNoun}`
  const subtitle = mode === "salons" ? salonSubtitle : artistSubtitle

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            All near you
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === "salons" ? "Show salons on a map" : "Show artists on a map"}
          onPress={() => onOpenMap(mode)}
          style={({ pressed }) => [styles.mapPill, pressed && styles.chipPressed]}
        >
          <Icon name="map-outline" size={16} color="#111111" />
          <Text style={styles.mapText}>Map</Text>
        </Pressable>
      </View>

      <View style={styles.switchPad}>
        <ModeSwitch mode={mode} onChange={setMode} />
      </View>

      {mode === "artists" ? (
        <>
          <ArtistChips chips={artistChips} onChange={setArtistChips} canSortByDistance={hasDistances} />
          <View style={styles.pad}>
            {nearbyArtists.status === "loading" ? (
              <View accessibilityLabel="Loading artists">
                {[0, 1, 2].map((i) => (
                  <ArtistListRowSkeleton key={i} />
                ))}
              </View>
            ) : nearbyArtists.status === "error" || shownArtists.length === 0 ? (
              <View style={styles.emptyPad}>
                <ArtistsEmptyCard failed={nearbyArtists.status === "error"} />
              </View>
            ) : (
              <>
                {shownArtists.slice(0, ARTIST_LIMIT).map((artist) => (
                  <ArtistListRow key={artist.slug} artist={artist} labels={nearbyArtists.labels} />
                ))}
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/artists",
                      params: artistChips.home ? { sort: "nearest", where: "home" } : { sort: "nearest" },
                    })
                  }
                  style={({ pressed }) => [styles.seeAll, pressed && styles.chipPressed]}
                >
                  <Text style={styles.seeAllText}>See all artists</Text>
                </Pressable>
              </>
            )}
          </View>
        </>
      ) : (
        <>
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
                <Text style={styles.seeAllText}>{`See all ${total} ${total === 1 ? "salon" : "salons"}`}</Text>
              </Pressable>
            </View>
          )}
        </>
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
  switchPad: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  switchTrack: {
    flexDirection: "row",
    backgroundColor: "#f3f1ef",
    borderRadius: 12,
    padding: 3,
  },
  switchSegment: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  switchSegmentOn: {
    backgroundColor: "#ffffff",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  switchText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: "#4b5563",
  },
  switchTextOn: {
    color: "#111111",
  },
  emptyPad: {
    marginTop: 10,
  },
  empty: {
    height: 160,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: "#111111",
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
    textAlign: "center",
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
    // Sits right under HomeV4, whose Top rated row (8) and wrap (20) already leave the usual 28.
    marginTop: 0,
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
