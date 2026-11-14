import { useRouter } from "expo-router"
import { Pressable, StyleSheet, View } from "react-native"

import { formatKm } from "@/components/home/HomeNextBookingCard"
import { PhotoOrFallback } from "@/components/home/PhotoFallback"
import { Text } from "@/components/ui/Text"
import { artistLevelLabel, showArtistLevelToCustomers } from "@/lib/artist-level"
import { artistCategoryLabel, type ArtistCardData } from "@/lib/artists-api"
import { formatRupees } from "@/lib/service-pricing"
import { fontFamily } from "@/theme/tokens"

/** "Home & studio" / "Home visits" / "Studio" from the artist card's flags. */
export function artistWhereLabel(artist: ArtistCardData): string | null {
  if (artist.offersHomeVisits && artist.hasStudio) return "Home & studio"
  if (artist.offersHomeVisits) return "Home visits"
  if (artist.hasStudio) return "Studio"
  return null
}

/** Rated artists only: an artist with no reviews has no rating to show. */
export function artistRating(artist: ArtistCardData): number | null {
  return (artist.reviewCount ?? 0) > 0 && (artist.averageRating ?? 0) > 0 ? artist.averageRating! : null
}

/** Vertical list row matching SalonListRow: 96px photo, name + rating, meta, price line, tags. */
export function ArtistListRow({ artist, labels }: { artist: ArtistCardData; labels: Record<string, string> }) {
  const router = useRouter()
  const rating = artistRating(artist)
  const meta = [artistWhereLabel(artist), formatKm(artist.distanceKm)].filter(Boolean).join(" · ")
  const categoryIds = [
    ...(artist.primaryCategory ? [artist.primaryCategory] : []),
    ...artist.categories.filter((id) => id !== artist.primaryCategory),
  ]
  const firstCategory = categoryIds[0] ? artistCategoryLabel(categoryIds[0], labels) : null
  const price =
    artist.startingPrice != null && artist.startingPrice > 0
      ? `${firstCategory ?? "Services"} from ${formatRupees(artist.startingPrice)}`
      : null
  const level =
    artist.level && showArtistLevelToCustomers(artist.level) ? artistLevelLabel(artist.level, artist.levelLabel) : null
  const tags = categoryIds.slice(0, 2).map((id) => artistCategoryLabel(id, labels))
  const image = artist.profilePhotoUrl?.trim() || artist.portfolio.find((url) => url?.trim()) || null

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        artist.displayName,
        rating != null ? `rated ${rating.toFixed(1)}` : "new",
        meta || null,
        price,
        level,
      ]
        .filter(Boolean)
        .join(". ")}
      onPress={() =>
        router.push({
          pathname: "/artist/[slug]",
          params: { slug: artist.slug, name: artist.displayName },
        })
      }
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.image}>
        <PhotoOrFallback uri={image} name={artist.displayName} />
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {artist.displayName}
          </Text>
          {rating != null ? (
            <View style={styles.rating}>
              <Text style={styles.ratingText}>{`${rating.toFixed(1)}★`}</Text>
            </View>
          ) : (
            <View style={[styles.rating, styles.ratingNew]}>
              <Text style={[styles.ratingText, styles.ratingNewText]}>New</Text>
            </View>
          )}
        </View>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {price ? (
          <Text style={styles.price} numberOfLines={1}>
            {price}
          </Text>
        ) : null}
        {level || tags.length > 0 ? (
          <View style={styles.tags}>
            {level ? (
              <View style={[styles.tag, styles.tagLevel]}>
                <Text style={[styles.tagText, styles.tagLevelText]}>{level}</Text>
              </View>
            ) : null}
            {tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

/** Loading placeholder with the row's shape, so the list doesn't jump when artists arrive. */
export function ArtistListRowSkeleton() {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.image, styles.skeleton]} />
      <View style={styles.body}>
        <View style={[styles.skeletonLine, { width: "60%" }]} />
        <View style={[styles.skeletonLine, { width: "45%", marginTop: 10 }]} />
        <View style={[styles.skeletonLine, { width: "55%", marginTop: 10 }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  pressed: {
    opacity: 0.85,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f2f2f2",
  },
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: "#111111",
  },
  rating: {
    backgroundColor: "#e6f5ec",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  ratingText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: "#17633e",
  },
  ratingNew: {
    backgroundColor: "#f3f3f3",
  },
  ratingNewText: {
    color: "#4b5563",
  },
  meta: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
  },
  price: {
    marginTop: 4,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: "#111111",
  },
  tags: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#f3f3f3",
  },
  tagText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 14,
    color: "#333333",
  },
  tagLevel: {
    backgroundColor: "#fff1ec",
  },
  tagLevelText: {
    color: "#8a3524",
  },
  skeleton: {
    backgroundColor: "#efefef",
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#efefef",
  },
})
