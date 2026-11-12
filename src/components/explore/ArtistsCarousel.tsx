import { useRouter, type Href } from "expo-router"
import { useEffect, useRef, useState } from "react"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"

import { ArtistCard } from "@/components/ui/ArtistCard"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import {
  artistCategoryLabel,
  fetchArtists,
  fetchHomeArtists,
  getHomeArtistsSnapshot,
  type ArtistCardData,
} from "@/lib/artists-api"
import { NEARBY_RADIUS_KM } from "@/lib/explore-location"
import { colors, spacing } from "@/theme/tokens"

type Props = {
  latitude?: number | null
  longitude?: number | null
  /** Search text from Home: show artists offering that service instead of the nearby list. */
  query?: string
  /** Bump to force a network refresh (e.g. Home pull-to-refresh). */
  refreshKey?: number
  /** How many artists it found, so Home can soften its "no salons here" state. */
  onCount?: (count: number) => void
}

export function ArtistsCarousel({ latitude, longitude, query, refreshKey = 0, onCount }: Props) {
  const router = useRouter()
  const { width: windowWidth } = useWindowDimensions()
  const lat = latitude ?? undefined
  const lng = longitude ?? undefined
  const cached = getHomeArtistsSnapshot(lat, lng)
  const [artists, setArtists] = useState<ArtistCardData[] | null>(
    cached?.artists ?? null,
  )
  const [labels, setLabels] = useState<Record<string, string>>(cached?.labels ?? {})

  const q = query?.trim() ?? ""
  const force = refreshKey > 0

  useEffect(() => {
    if (!q) return
    let cancelled = false
    const controller = new AbortController()
    if (force) setArtists(null)
    void fetchArtists({ q, latitude: lat, longitude: lng, sort: "nearest", limit: 10 }, controller.signal)
      .then((data) => {
        if (!cancelled) setArtists(data.artists ?? [])
      })
      .catch(() => {
        if (!cancelled) setArtists([])
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [q, lat, lng, refreshKey, force])

  const lastCoords = useRef(`${lat},${lng}`)

  useEffect(() => {
    if (q) return
    let cancelled = false
    const snap = getHomeArtistsSnapshot(lat, lng)
    const moved = lastCoords.current !== `${lat},${lng}`
    lastCoords.current = `${lat},${lng}`
    if (snap && !force) {
      setArtists(snap.artists)
      setLabels(snap.labels)
    } else if (moved) {
      // Don't keep showing the old place's artists while the new ones load.
      setArtists(null)
    }

    void fetchHomeArtists({ latitude: lat, longitude: lng, force }).then((entry) => {
      if (cancelled) return
      setArtists(entry.artists)
      setLabels(entry.labels)
    })

    return () => {
      cancelled = true
    }
  }, [lat, lng, q, refreshKey, force])

  useEffect(() => {
    onCount?.(artists?.length ?? 0)
  }, [artists, onCount])

  if (!artists || artists.length === 0) return null

  const gap = spacing.md
  const padLeft = spacing.lg
  // Same size as the salon cards, so Home reads as one system.
  const cardWidth = Math.min(260, Math.round(windowWidth * 0.64))

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="heading">{q ? `Artists for “${q}”` : "Beauty artists near you"}</Text>
          <Text variant="caption" muted style={{ marginTop: 2 }}>
            {q
              ? "Solo artists who offer this, nearest first"
              : `Within ${NEARBY_RADIUS_KM} km · makeup, hair, mehendi and more`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all artists"
          onPress={() => router.push("/artists" as Href)}
          hitSlop={8}
          style={styles.seeAll}
        >
          <Text variant="caption" style={styles.seeAllText}>
            See all
          </Text>
          <Icon name="arrow-forward" size={14} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={[styles.row, { paddingLeft: padLeft }]}
        decelerationRate="fast"
        snapToInterval={cardWidth + gap}
        snapToAlignment="start"
        disableIntervalMomentum
      >
        {artists.map((artist) => (
          <View key={artist.slug} style={{ width: cardWidth }}>
            <ArtistCard
              artist={artist}
              compact
              categoryLabel={(id) => artistCategoryLabel(id, labels)}
              onPress={() =>
                router.push({
                  pathname: "/artist/[slug]",
                  params: { slug: artist.slug, name: artist.displayName },
                } as Href)
              }
            />
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32,
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: "Geist_600SemiBold",
  },
  scroller: {
    marginHorizontal: -spacing.lg,
  },
  row: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
})
