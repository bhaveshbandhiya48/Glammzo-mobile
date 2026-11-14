import { useCallback, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { ArtistListRow, ArtistListRowSkeleton } from "@/components/home/ArtistListRow"
import { SalonListRow } from "@/components/home/SalonListRow"
import { Chip, EmptyState, HEADER_TINTS, ProfileSubScreen } from "@/components/profile/ProfileScreenParts"
import { pastels, sp, ui } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { useArtistFavorites } from "@/context/ArtistFavoritesContext"
import { useFavorites } from "@/context/FavoritesContext"
import type { Salon } from "@/data/types"
import { fetchFavoriteArtistSlugs } from "@/lib/artist-favorites-api"
import { fetchPublicArtist, type ArtistCardData, type PublicArtist } from "@/lib/artists-api"
import { fetchSalons, getCatalogSnapshot } from "@/lib/salons-api"

type Tab = "salons" | "artists"
const NO_LABELS: Record<string, string> = {}
const LOGIN_ROUTE = { pathname: "/login", params: { next: "/profile/favorites" } } as const

/** The artist page payload in the shape the shared list row reads. */
function toCardData(artist: PublicArtist): ArtistCardData {
  const prices = artist.services.map((service) => Number(service.price)).filter((price) => price > 0)
  const portfolio = (artist.portfolio ?? [])
    .map((item) => item.thumbnailUrl?.trim() || item.imageUrl?.trim() || "")
    .filter(Boolean)
  return {
    slug: artist.slug,
    url: "",
    displayName: artist.displayName,
    area: artist.area,
    city: artist.city,
    profilePhotoUrl: artist.profilePhotoUrl,
    categories: artist.categories,
    primaryCategory: artist.categories[0] ?? null,
    startingPrice: prices.length > 0 ? Math.min(...prices) : null,
    offersHomeVisits: artist.offersHomeVisits,
    hasStudio: artist.services.some((service) => service.locationMode !== "client_home"),
    serviceRadiusKm: artist.serviceRadiusKm,
    yearsExperience: artist.yearsExperience,
    portfolio,
    distanceKm: null,
    coversYourArea: null,
    averageRating: artist.averageRating,
    reviewCount: artist.reviewCount,
    level: artist.level,
    levelLabel: artist.levelLabel,
    isVerified: artist.isVerified,
  }
}

export default function FavoritesScreen() {
  const router = useRouter()
  const { ids, refresh, toggle: toggleSalon } = useFavorites()
  const { refresh: refreshArtistFavorites, toggle: toggleArtist } = useArtistFavorites()
  const [catalog, setCatalog] = useState<Salon[]>([])
  const [artists, setArtists] = useState<ArtistCardData[]>([])
  const [unsavedArtists, setUnsavedArtists] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab | null>(null)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      setLoading(true)
      void Promise.all([
        refresh(),
        refreshArtistFavorites(),
        fetchSalons(),
        fetchFavoriteArtistSlugs().catch(() => [] as string[]),
      ])
        .then(async ([, , { salons }, slugs]) => {
          if (cancelled) return
          setCatalog(salons)
          setUnsavedArtists([])
          const unique = Array.from(new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean)))
          if (unique.length === 0) {
            setArtists([])
            return
          }
          const loaded = await Promise.all(
            unique.map(async (slug) => {
              try {
                return toCardData(await fetchPublicArtist(slug))
              } catch {
                return null
              }
            }),
          )
          if (!cancelled) {
            setArtists(loaded.filter((a): a is ArtistCardData => a != null))
          }
        })
        .catch(() => {
          if (cancelled) return
          setCatalog(getCatalogSnapshot())
          setArtists([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }, [refresh, refreshArtistFavorites]),
  )

  const salons = catalog.filter((salon) => ids.includes(salon.id))
  const savedArtists = artists.filter((artist) => !unsavedArtists.includes(artist.slug))
  const total = salons.length + savedArtists.length
  // Open on Artists only when there are saved artists and no saved salons.
  const activeTab: Tab = tab ?? (salons.length === 0 && savedArtists.length > 0 ? "artists" : "salons")

  function unsaveSalon(salon: Salon) {
    void (async () => {
      if ((await toggleSalon(salon.id)) === "auth") router.push(LOGIN_ROUTE)
    })()
  }

  function unsaveArtist(artist: ArtistCardData) {
    void (async () => {
      const result = await toggleArtist(artist.slug)
      if (result === "auth") router.push(LOGIN_ROUTE)
      else setUnsavedArtists((current) => [...current, artist.slug])
    })()
  }

  let body
  if (loading) {
    body = (
      <View accessibilityLabel="Loading your saved salons and artists">
        <ArtistListRowSkeleton />
        <ArtistListRowSkeleton />
        <ArtistListRowSkeleton />
      </View>
    )
  } else if (activeTab === "salons") {
    body =
      salons.length === 0 ? (
        <EmptyState
          pastel={pastels.pink}
          icon="heart-outline"
          title="No saved salons yet"
          text="Tap the heart on a salon to save it here."
          ctaLabel="Find a salon"
          onCta={() => router.push("/(tabs)/explore")}
        />
      ) : (
        <View>
          {salons.map((salon) => (
            <View key={salon.id}>
              <SalonListRow salon={salon} />
              <HeartButton name={salon.name} onPress={() => unsaveSalon(salon)} />
            </View>
          ))}
        </View>
      )
  } else {
    body =
      savedArtists.length === 0 ? (
        <EmptyState
          pastel={pastels.lavender}
          icon="heart-outline"
          title="No saved artists yet"
          text="Tap the heart on an artist's page to save them here."
          ctaLabel="Find an artist"
          onCta={() => router.push("/(tabs)/explore")}
        />
      ) : (
        <View>
          {savedArtists.map((artist) => (
            <View key={artist.slug}>
              <ArtistListRow artist={artist} labels={NO_LABELS} />
              <HeartButton name={artist.displayName} onPress={() => unsaveArtist(artist)} />
            </View>
          ))}
        </View>
      )
  }

  return (
    <ProfileSubScreen
      title="Saved"
      subtitle={loading ? "Salons and artists you've saved" : `${total} saved`}
      tint={HEADER_TINTS.saved}
    >
      <View style={styles.chips}>
        <Chip
          label={loading ? "Salons" : `Salons · ${salons.length}`}
          active={activeTab === "salons"}
          onPress={() => setTab("salons")}
        />
        <Chip
          label={loading ? "Artists" : `Artists · ${savedArtists.length}`}
          active={activeTab === "artists"}
          onPress={() => setTab("artists")}
        />
      </View>
      {body}
    </ProfileSubScreen>
  )
}

/** Filled heart over the row photo; tapping it unsaves, like the heart on the salon or artist page. */
function HeartButton({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${name} from saved`}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.heart, pressed && ui.pressed]}
    >
      <Icon name="heart" size={16} color="#e0245e" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 4 },
  heart: {
    position: "absolute",
    top: 20,
    left: 62,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: sp.border,
    alignItems: "center",
    justifyContent: "center",
  },
})
