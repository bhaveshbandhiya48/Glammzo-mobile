import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ArtistListRow, ArtistListRowSkeleton } from "@/components/home/ArtistListRow"
import { GradientFill } from "@/components/home/GradientFill"
import { SalonListRow } from "@/components/home/SalonListRow"
import { ServiceTileIcon } from "@/components/home/ServiceTileIcon"
import {
  SEE_ALL_EMPTY_COLORS,
  SeeAllChip,
  SeeAllChipRow,
  SeeAllEmpty,
  SeeAllHeader,
} from "@/components/list/SeeAllParts"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Salon } from "@/data/types"
import { fetchArtistCategories, fetchArtists, type ArtistCardData } from "@/lib/artists-api"
import {
  browseModeFor,
  salonsInSelectedLocation,
  withSalonDistanceFromLocation,
} from "@/lib/explore-location"
import { sortExploreSalons } from "@/lib/explore-filters"
import { parseHomeAudience } from "@/lib/home-audience"
import { salonsForTile } from "@/lib/home-salon-info"
import { bootstrapLaunchLocation } from "@/lib/launch-permissions"
import { fetchSalons, getCatalogSnapshot } from "@/lib/salons-api"
import { getServiceTile, type HomeAudience } from "@/lib/service-tiles"
import { isGetQuotesEnabled } from "@/lib/get-quotes"
import { DEFAULT_SAVED_LOCATION, getSavedLocation, type SavedLocation } from "@/lib/user"
import { fontFamily } from "@/theme/tokens"

type Tab = "salons" | "artists"

type ArtistsState =
  | { status: "loading" }
  | { status: "ready"; artists: ArtistCardData[] }
  | { status: "unavailable" }

/** One service (a Home tile): nearby salons that offer it, and solo artists in its category. */
export default function ServiceScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ key?: string; audience?: string }>()
  const tile = getServiceTile(typeof params.key === "string" ? params.key : null)
  const [audience, setAudience] = useState<HomeAudience>(
    () => parseHomeAudience(params.audience) ?? "women",
  )
  const [tab, setTab] = useState<Tab>("salons")
  const [location, setLocation] = useState<SavedLocation | null>(null)
  const [catalog, setCatalog] = useState<Salon[]>(() => getCatalogSnapshot())
  const [loading, setLoading] = useState(true)
  const [artistsState, setArtistsState] = useState<ArtistsState>({ status: "loading" })

  const [labels, setLabels] = useState<Record<string, string>>({})

  // This screen draws its own peach header.
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false, title: tile?.label ?? "Service" })
  }, [navigation, tile?.label])

  useEffect(() => {
    let active = true
    void fetchArtistCategories().then((catalog) => {
      if (!active || !catalog) return
      setLabels(Object.fromEntries(catalog.categories.map((c) => [c.id, c.label])))
    })
    return () => {
      active = false
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      let active = true
      void (async () => {
        await bootstrapLaunchLocation()
        const saved = (await getSavedLocation()) ?? DEFAULT_SAVED_LOCATION
        if (!active) return
        setLocation(saved)
        const cached = getCatalogSnapshot()
        if (cached.length > 0) {
          setCatalog(cached)
          setLoading(false)
        }
        try {
          const { salons } = await fetchSalons()
          if (active) setCatalog(salons)
        } catch {
          const fallback = getCatalogSnapshot()
          if (active && fallback.length > 0) setCatalog(fallback)
        } finally {
          if (active) setLoading(false)
        }
      })()
      return () => {
        active = false
      }
    }, []),
  )

  useEffect(() => {
    if (!tile || !location) return
    const controller = new AbortController()
    setArtistsState({ status: "loading" })
    const hasCoords = location.latitude != null && location.longitude != null
    fetchArtists(
      {
        category: tile.artistCategory,
        latitude: location.latitude,
        longitude: location.longitude,
        sort: hasCoords ? "nearest" : "recommended",
        limit: 30,
      },
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setArtistsState({ status: "ready", artists: data.artists ?? [] })
        }
      })
      .catch(() => {
        // Artists module off (flag) or unreachable: friendly empty state.
        if (!controller.signal.aborted) setArtistsState({ status: "unavailable" })
      })
    return () => controller.abort()
  }, [tile, location])

  const salons = useMemo(() => {
    if (!tile || !location) return []
    const nearby = salonsInSelectedLocation(catalog, location, browseModeFor(location)).map(
      (salon) => withSalonDistanceFromLocation(salon, location),
    )
    return sortExploreSalons(salonsForTile(nearby, tile, audience), "nearest")
  }, [audience, catalog, location, tile])

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)")
  }

  if (!tile) {
    return (
      <View style={styles.root}>
        <SeeAllHeader title="Service" subtitle="Not found" onBack={goBack} />
        <SeeAllEmpty
          icon="help-circle-outline"
          colors={SEE_ALL_EMPTY_COLORS.error}
          title="Service not found"
          body="This service isn't available any more."
          actionLabel="Back to Home"
          onAction={goBack}
        />
      </View>
    )
  }

  const emptyTitle = `No ${tile.label.toLowerCase()} near you yet`
  const artists = artistsState.status === "ready" ? artistsState.artists : []
  const salonCount = loading ? null : salons.length
  const artistCount = artistsState.status === "ready" ? artists.length : null
  const subtitle =
    tab === "salons"
      ? salonCount == null
        ? "Finding salons near you…"
        : `${salonCount} ${salonCount === 1 ? "salon" : "salons"} near you`
      : artistCount == null
        ? artistsState.status === "unavailable"
          ? "Solo artists"
          : "Finding artists near you…"
        : `${artistCount} ${artistCount === 1 ? "artist" : "artists"} near you`

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={6}
            onPress={goBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Icon name="chevron-back" size={20} color="#111111" />
          </Pressable>
          <View style={styles.tileIcon}>
            <GradientFill colors={tile.gradient} angle={150} radius={14} />
            <ServiceTileIcon tile={tile} size={26} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
              {tile.label}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
      >
        <SeeAllChipRow>
          {(["salons", "artists"] as const).map((id) => {
            const count = id === "salons" ? salonCount : artistCount
            const label = id === "salons" ? "Salons" : "Artists"
            return (
              <SeeAllChip
                key={id}
                label={count != null ? `${label} · ${count}` : label}
                on={tab === id}
                onPress={() => setTab(id)}
                a11y={`Show ${label.toLowerCase()}`}
              />
            )
          })}
          {tab === "salons" ? <View style={styles.chipDivider} /> : null}
          {tab === "salons"
            ? (["women", "men"] as const).map((id) => (
                <SeeAllChip
                  key={id}
                  icon={id === audience ? "people" : "people-outline"}
                  label={id === "women" ? "Women" : "Men"}
                  on={audience === id}
                  onPress={() => setAudience(id)}
                  a11y={`Show services for ${id === "women" ? "Women" : "Men"}`}
                />
              ))
            : null}
          {tab === "artists" && isGetQuotesEnabled() ? (
            <SeeAllChip
              icon="chatbubbles-outline"
              label="Get quotes"
              on={false}
              onPress={() =>
                router.push({ pathname: "/requests/new", params: { category: tile.artistCategory } })
              }
              a11y="Get quotes from artists"
              trailing="chevron-forward"
            />
          ) : null}
        </SeeAllChipRow>

        <View style={styles.body}>
          {tab === "salons" ? (
            loading && salons.length === 0 ? (
              <Skeletons />
            ) : salons.length === 0 ? (
              <SeeAllEmpty
                icon="business-outline"
                colors={tile.gradient}
                title={emptyTitle}
                body="Try the Artists tab, or change your location on Home."
                actionLabel="Show artists"
                onAction={() => setTab("artists")}
              />
            ) : (
              salons.map((salon) => (
                <View key={salon.id} style={styles.pad}>
                  <SalonListRow salon={salon} featured={salon.isFeatured === true} />
                </View>
              ))
            )
          ) : artistsState.status === "loading" ? (
            <Skeletons />
          ) : artistsState.status === "unavailable" ? (
            <SeeAllEmpty
              icon="cloud-offline-outline"
              colors={SEE_ALL_EMPTY_COLORS.error}
              title="Artists aren't available right now"
              body="Solo artists will show here soon. Check the Salons tab in the meantime."
              actionLabel="Show salons"
              onAction={() => setTab("salons")}
            />
          ) : artists.length === 0 ? (
            <SeeAllEmpty
              icon="sparkles-outline"
              colors={SEE_ALL_EMPTY_COLORS.artists}
              title={emptyTitle}
              body="Check back soon, new artists join every week."
            />
          ) : (
            artists.map((artist) => (
              <View key={artist.slug} style={styles.pad}>
                <ArtistListRow artist={artist} labels={labels} />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function Skeletons() {
  return (
    <>
      {[0, 1, 2].map((id) => (
        <View key={id} style={styles.pad}>
          <ArtistListRowSkeleton />
        </View>
      ))}
    </>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffffff" },
  pressed: { opacity: 0.7 },
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: "#111111",
  },
  subtitle: {
    marginTop: 1,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
  },
  chipDivider: { width: 1, height: 20, backgroundColor: "#e3e3e3", marginHorizontal: 2 },
  body: { paddingTop: 4 },
  pad: { paddingHorizontal: 20 },
})
