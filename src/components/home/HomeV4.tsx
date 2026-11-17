import { useRouter } from "expo-router"
import { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"

import { BookAgainRow } from "@/components/home/BookAgainRow"
import { GetQuotesBanner, isGetQuotesEnabled } from "@/components/home/GetQuotesBanner"
import { HomeHeader } from "@/components/home/HomeHeader"
import { HomeNextBookingCard } from "@/components/home/HomeNextBookingCard"
import { AllServicesSheet, ServiceTilesSection } from "@/components/home/ServiceTiles"
import { TopRatedRow, type DiscoveryKind } from "@/components/home/TopRatedRow"
import {
  pickBookAgain,
  pickNextHomeBooking,
  useHomeBookings,
} from "@/components/home/useHomeBookings"
import { useTopArtists } from "@/components/home/useTopArtists"
import type { Salon } from "@/data/types"
import { currentAreaLabel } from "@/lib/explore-location"
import { haversineKm } from "@/lib/geo"
import { useHomeAudience } from "@/lib/home-audience"
import { topRatedSalons } from "@/lib/home-salon-info"
import { resolveSalonById } from "@/lib/salons-api"
import { artistsSeeAllParams, salonsSeeAllParams } from "@/lib/see-all-params"
import type { ServiceTile } from "@/lib/service-tiles"
import type { SavedLocation } from "@/lib/user"
import { spacing } from "@/theme/tokens"

type Props = {
  username: string | null
  /** Null while the launch location is still resolving. */
  location: SavedLocation | null
  searchQuery: string
  /** Show the sections below the header (Home ready, no search). */
  showSections: boolean
  /** Salons for the current location, with distance (Explore's location result). */
  salons: Salon[]
  refreshKey: number
  onSearchPress: () => void
  onClearSearch: () => void
  onLocationPress: () => void
}

/**
 * Home top (V5): header, next booking, service tiles, quotes banner, book again
 * and top rated. Explore renders it first inside its ScrollView; the existing
 * Home sections (offers, carousels) follow below it.
 */
export function HomeV4({
  username,
  location,
  searchQuery,
  showSections,
  salons,
  refreshKey,
  onSearchPress,
  onClearSearch,
  onLocationPress,
}: Props) {
  const router = useRouter()
  const [audience, setAudience] = useHomeAudience()
  const [allOpen, setAllOpen] = useState(false)
  const [bookings] = useHomeBookings(refreshKey)

  const nextBooking = useMemo(() => pickNextHomeBooking(bookings), [bookings])
  const bookAgain = useMemo(() => pickBookAgain(bookings), [bookings])
  const topRated = useMemo(() => topRatedSalons(salons), [salons])
  const topArtists = useTopArtists(location?.latitude, location?.longitude, refreshKey)

  const nextSalon = useMemo(() => {
    if (!nextBooking || nextBooking.kind === "artist") return undefined
    return salons.find((salon) => salon.id === nextBooking.salonId) ?? resolveSalonById(nextBooking.salonId)
  }, [nextBooking, salons])

  const nextDistanceKm = useMemo(() => {
    if (
      nextSalon?.latitude == null ||
      nextSalon.longitude == null ||
      location?.latitude == null ||
      location.longitude == null
    ) {
      return null
    }
    return haversineKm(location.latitude, location.longitude, nextSalon.latitude, nextSalon.longitude)
  }, [location?.latitude, location?.longitude, nextSalon])

  const areaLabel = location ? currentAreaLabel(location) ?? location.label : "Locating…"
  const city = location?.city?.trim()
  const cityLabel = city && city.toLowerCase() !== areaLabel.toLowerCase() ? city : null

  function seeAllTopRated(kind: DiscoveryKind) {
    // Top rated: salons open sorted by rating; artists keep their where / nearest params.
    if (kind === "salons") {
      router.push({ pathname: "/salons", params: salonsSeeAllParams({ filters: { sort: "rating" }, audience }) })
    } else if (kind === "home") {
      router.push({ pathname: "/artists", params: artistsSeeAllParams({ where: "home", audience }) })
    } else {
      router.push({ pathname: "/artists", params: artistsSeeAllParams({ sort: "nearest", audience }) })
    }
  }

  function openTile(tile: ServiceTile) {
    router.push({ pathname: "/service/[key]", params: { key: tile.key, audience } })
  }

  return (
    <View style={styles.wrap}>
      <HomeHeader
        username={username}
        areaLabel={areaLabel}
        cityLabel={cityLabel}
        searchQuery={searchQuery}
        onLocationPress={onLocationPress}
        onSearchPress={onSearchPress}
        onClearSearch={onClearSearch}
        onNotificationsPress={() => router.push("/notifications")}
        onProfilePress={() => router.push("/(tabs)/profile")}
      />

      {showSections ? (
        <>
          {nextBooking ? (
            <HomeNextBookingCard booking={nextBooking} salon={nextSalon} distanceKm={nextDistanceKm} />
          ) : null}
          <ServiceTilesSection
            audience={audience}
            onAudienceChange={setAudience}
            onPressTile={openTile}
            onSeeAll={() => setAllOpen(true)}
          />
          {isGetQuotesEnabled() ? <GetQuotesBanner /> : null}
          <BookAgainRow bookings={bookAgain} />
          <TopRatedRow
            salons={topRated}
            artists={topArtists.artists}
            homeArtists={topArtists.homeArtists}
            artistsStatus={topArtists.status}
            artistLabels={topArtists.labels}
            onSeeAll={seeAllTopRated}
          />
        </>
      ) : null}

      <AllServicesSheet visible={allOpen} audience={audience} onClose={() => setAllOpen(false)} onPressTile={openTile} />
    </View>
  )
}

const styles = StyleSheet.create({
  // Explore's ScrollView pads its content; the header runs edge to edge and to the top.
  wrap: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.md,
    marginBottom: spacing.xl,
    backgroundColor: "#ffffff",
  },
})
