import { Image } from "expo-image"
import { useCallback, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter, type Href } from "expo-router"

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Screen } from "@/components/ui/Screen"
import { SalonCard } from "@/components/ui/SalonCard"
import { ExploreSalonsSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { useArtistFavorites } from "@/context/ArtistFavoritesContext"
import { useFavorites } from "@/context/FavoritesContext"
import type { Salon } from "@/data/types"
import {
  fetchFavoriteArtistSlugs,
} from "@/lib/artist-favorites-api"
import {
  fetchPublicArtist,
  type PublicArtist,
} from "@/lib/artists-api"
import { fetchSalons, getCatalogSnapshot } from "@/lib/salons-api"
import { colors, radii, spacing } from "@/theme/tokens"

type FavoriteArtist = Pick<
  PublicArtist,
  "slug" | "displayName" | "city" | "area" | "profilePhotoUrl"
>

export default function FavoritesScreen() {
  const router = useRouter()
  const { ids, refresh } = useFavorites()
  const { refresh: refreshArtistFavorites } = useArtistFavorites()
  const [catalog, setCatalog] = useState<Salon[]>([])
  const [artists, setArtists] = useState<FavoriteArtist[]>([])
  const [loading, setLoading] = useState(true)

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
          const unique = Array.from(
            new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean)),
          )
          if (unique.length === 0) {
            setArtists([])
            return
          }
          const loaded = await Promise.all(
            unique.map(async (slug) => {
              try {
                const artist = await fetchPublicArtist(slug)
                return {
                  slug: artist.slug,
                  displayName: artist.displayName,
                  city: artist.city,
                  area: artist.area,
                  profilePhotoUrl: artist.profilePhotoUrl,
                } satisfies FavoriteArtist
              } catch {
                return null
              }
            }),
          )
          if (!cancelled) {
            setArtists(loaded.filter((a): a is FavoriteArtist => a != null))
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
  const empty = salons.length === 0 && artists.length === 0

  return (
    <Screen scroll>
      <Text variant="title">Saved</Text>
      <Text muted style={styles.gap}>
        Salons and solo artists you can book again quickly.
      </Text>

      {loading ? (
        <View style={styles.list}>
          <ExploreSalonsSkeleton count={2} />
        </View>
      ) : empty ? (
        <View style={styles.empty}>
          <Text variant="bodyStrong">Nothing saved yet</Text>
          <Text muted>
            Tap the heart on a salon or solo-artist page to save them here.
          </Text>
          <Button label="Explore" onPress={() => router.push("/(tabs)/explore")} />
        </View>
      ) : (
        <>
          {salons.length > 0 ? (
            <View style={styles.block}>
              <Text variant="heading">Salons</Text>
              <View style={styles.list}>
                {salons.map((salon) => (
                  <SalonCard
                    key={salon.id}
                    salon={salon}
                    onPress={() =>
                      router.push({ pathname: "/salon/[id]", params: { id: salon.id } })
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}

          {artists.length > 0 ? (
            <View style={styles.block}>
              <Text variant="heading">Solo artists</Text>
              <View style={styles.artistList}>
                {artists.map((artist) => {
                  const where = [artist.area, artist.city].filter(Boolean).join(", ")
                  return (
                    <Pressable
                      key={artist.slug}
                      onPress={() =>
                        router.push({
                          pathname: "/artist/[slug]",
                          params: { slug: artist.slug },
                        } as Href)
                      }
                      style={({ pressed }) => [styles.artistCard, pressed && { opacity: 0.9 }]}
                      accessibilityRole="button"
                      accessibilityLabel={artist.displayName}
                    >
                      {artist.profilePhotoUrl ? (
                        <Image
                          source={{ uri: artist.profilePhotoUrl }}
                          style={styles.artistAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.artistAvatar, styles.artistAvatarFallback]}>
                          <Text variant="heading" color={colors.primary}>
                            {artist.displayName.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text variant="heading" numberOfLines={1}>
                          {artist.displayName}
                        </Text>
                        {where ? (
                          <Text variant="caption" muted numberOfLines={1}>
                            {where}
                          </Text>
                        ) : null}
                      </View>
                      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  gap: {
    marginTop: spacing.sm,
  },
  empty: {
    marginTop: spacing.xxxl,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderStyle: "dashed",
    backgroundColor: colors.card,
  },
  block: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  list: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  artistList: {
    gap: spacing.sm,
  },
  artistCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  artistAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.muted,
  },
  artistAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
})
