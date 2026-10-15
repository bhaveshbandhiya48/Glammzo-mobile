import { useRouter, type Href } from "expo-router"
import { useEffect, useState } from "react"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"

import { ArtistCard } from "@/components/ui/ArtistCard"
import { Text } from "@/components/ui/Text"
import {
  artistCategoryLabel,
  fetchHomeArtists,
  getHomeArtistsSnapshot,
  type ArtistCardData,
} from "@/lib/artists-api"
import { colors, spacing } from "@/theme/tokens"

type Props = {
  latitude?: number | null
  longitude?: number | null
}

export function ArtistsCarousel({ latitude, longitude }: Props) {
  const router = useRouter()
  const { width: windowWidth } = useWindowDimensions()
  const lat = latitude ?? undefined
  const lng = longitude ?? undefined
  const cached = getHomeArtistsSnapshot(lat, lng)
  const [artists, setArtists] = useState<ArtistCardData[] | null>(
    cached?.artists ?? null,
  )
  const [labels, setLabels] = useState<Record<string, string>>(cached?.labels ?? {})

  useEffect(() => {
    let cancelled = false
    const snap = getHomeArtistsSnapshot(lat, lng)
    if (snap) {
      setArtists(snap.artists)
      setLabels(snap.labels)
    }

    void fetchHomeArtists({ latitude: lat, longitude: lng }).then((entry) => {
      if (cancelled) return
      setArtists(entry.artists)
      setLabels(entry.labels)
    })

    return () => {
      cancelled = true
    }
  }, [lat, lng])

  if (!artists || artists.length === 0) return null

  const gap = spacing.md
  const padLeft = spacing.lg
  const peek = Math.round(windowWidth * 0.12)
  const cardWidth = Math.min(280, windowWidth - padLeft - gap - peek)

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="heading">Solo artists</Text>
          <Text variant="caption" muted style={{ marginTop: 2 }}>
            Makeup, hair, mehendi and more
          </Text>
        </View>
        <Pressable onPress={() => router.push("/artists" as Href)} hitSlop={8}>
          <Text variant="bodyStrong" color={colors.coral}>
            See all
          </Text>
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
    alignItems: "flex-start",
    gap: spacing.md,
  },
  scroller: {
    marginHorizontal: -spacing.lg,
  },
  row: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
})
