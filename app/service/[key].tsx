import { useCallback, useEffect, useMemo, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router"

import { AudienceSwitch } from "@/components/home/AudienceSwitch"
import { ArtistCard } from "@/components/ui/ArtistCard"
import { Button } from "@/components/ui/Button"
import { SalonCard } from "@/components/ui/SalonCard"
import { Screen } from "@/components/ui/Screen"
import { ExploreSalonsSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import type { Salon } from "@/data/types"
import { artistCategoryLabel, fetchArtists, type ArtistCardData } from "@/lib/artists-api"
import {
  browseModeFor,
  salonsInSelectedLocation,
  withSalonDistanceFromLocation,
} from "@/lib/explore-location"
import { sortExploreSalons } from "@/lib/explore-filters"
import { parseHomeAudience } from "@/lib/home-audience"
import { salonsForTile } from "@/lib/home-salon-info"
import { bootstrapLaunchPermissions } from "@/lib/launch-permissions"
import { fetchSalons, getCatalogSnapshot } from "@/lib/salons-api"
import { getServiceTile, type HomeAudience } from "@/lib/service-tiles"
import { DEFAULT_SAVED_LOCATION, getSavedLocation, type SavedLocation } from "@/lib/user"
import { colors, fontFamily, radii, spacing } from "@/theme/tokens"

type Tab = "salons" | "artists"

type ArtistsState =
  | { status: "loading" }
  | { status: "ready"; artists: ArtistCardData[] }
  | { status: "unavailable" }

/** One service (a Home tile): nearby salons that offer it, and solo artists in its category. */
export default function ServiceScreen() {
  const router = useRouter()
  const navigation = useNavigation()
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

  useEffect(() => {
    navigation.setOptions({ title: tile?.label ?? "Service" })
  }, [navigation, tile?.label])

  useFocusEffect(
    useCallback(() => {
      let active = true
      void (async () => {
        await bootstrapLaunchPermissions()
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

  if (!tile) {
    return (
      <Screen scroll>
        <Text variant="title">Service not found</Text>
        <Button label="Back to Home" style={{ marginTop: spacing.xl }} onPress={() => router.back()} />
      </Screen>
    )
  }

  const emptyTitle = `No ${tile.label.toLowerCase()} near you yet`
  const artists = artistsState.status === "ready" ? artistsState.artists : []

  return (
    <Screen scroll>
      <View style={styles.toolbar}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(["salons", "artists"] as const).map((id) => {
            const active = tab === id
            const count = id === "salons" ? salons.length : artists.length
            const showCount = id === "salons" ? !loading : artistsState.status === "ready"
            return (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(id)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {id === "salons" ? "Salons" : "Artists"}
                  {showCount ? ` · ${count}` : ""}
                </Text>
              </Pressable>
            )
          })}
        </View>
        {tab === "salons" ? <AudienceSwitch value={audience} onChange={setAudience} /> : null}
      </View>

      {tab === "salons" ? (
        loading && salons.length === 0 ? (
          <ExploreSalonsSkeleton count={3} />
        ) : salons.length === 0 ? (
          <EmptyState title={emptyTitle} body="Try the Artists tab, or change your location on Home." />
        ) : (
          <View style={styles.list}>
            {salons.map((salon) => (
              <SalonCard
                key={salon.id}
                salon={salon}
                layout="list"
                onPress={() => router.push({ pathname: "/salon/[id]", params: { id: salon.id } })}
              />
            ))}
          </View>
        )
      ) : artistsState.status === "loading" ? (
        <ExploreSalonsSkeleton count={3} />
      ) : artistsState.status === "unavailable" ? (
        <EmptyState
          title="Artists aren't available right now"
          body="Solo artists will show here soon. Check the Salons tab in the meantime."
        />
      ) : artists.length === 0 ? (
        <EmptyState title={emptyTitle} body="Check back soon, new artists join every week." />
      ) : (
        <View style={styles.list}>
          {artists.map((artist) => (
            <ArtistCard
              key={artist.slug}
              artist={artist}
              categoryLabel={(id) => artistCategoryLabel(id)}
              onPress={() => router.push({ pathname: "/artist/[slug]", params: { slug: artist.slug } })}
            />
          ))}
        </View>
      )}
    </Screen>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text variant="bodyStrong">{title}</Text>
      <Text muted>{body}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tab: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.text,
  },
  tabTextActive: {
    color: colors.primaryFg,
  },
  list: {
    gap: spacing.lg,
  },
  empty: {
    gap: 6,
    paddingVertical: spacing.xxl,
  },
})
