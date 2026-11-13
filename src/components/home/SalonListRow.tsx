import { useRouter } from "expo-router"
import { Pressable, StyleSheet, View } from "react-native"

import { formatKm } from "@/components/home/HomeNextBookingCard"
import { PhotoOrFallback } from "@/components/home/PhotoFallback"
import { Text } from "@/components/ui/Text"
import { salonProfileImageUrl } from "@/data/mocks/salons"
import type { Salon, SalonService } from "@/data/types"
import { hasOpeningHours, salonAudienceBadge } from "@/lib/home-salon-info"
import { formatRupees } from "@/lib/service-pricing"
import { matchesTile, tilesMatching } from "@/lib/service-tiles"
import { fontFamily } from "@/theme/tokens"

/** "9 pm" / "9:30 pm" from the last time in a free-text hours string ("10:00 AM - 9:00 PM"). */
export function closingTimeLabel(hours: string | null | undefined): string | null {
  const text = (hours ?? "").trim()
  if (!text) return null
  const twelve = [...text.matchAll(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\b/gi)]
  let hour: number | null = null
  let minute = 0
  const last12 = twelve[twelve.length - 1]
  if (last12) {
    hour = Number(last12[1]) % 12
    minute = Number(last12[2] ?? 0)
    if (last12[3]?.toLowerCase() === "p") hour += 12
  } else {
    const twentyFour = [...text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)]
    const last24 = twentyFour[twentyFour.length - 1]
    if (!last24) return null
    hour = Number(last24[1])
    minute = Number(last24[2])
  }
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return null
  const period = hour >= 12 ? "pm" : "am"
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return minute ? `${h12}:${String(minute).padStart(2, "0")} ${period}` : `${h12} ${period}`
}

function cheapest(services: SalonService[]): SalonService | null {
  let best: SalonService | null = null
  for (const service of services) {
    if (!(service.price > 0)) continue
    if (!best || service.price < best.price) best = service
  }
  return best
}

/** "Haircut from ₹299": the salon's top category and its lowest price; else its cheapest service. */
export function salonPriceLine(salon: Salon): string | null {
  const top = tilesMatching(salon.services.flatMap((s) => [s.name, s.category]))[0]
  if (top) {
    const match = cheapest(
      salon.services.filter((s) => matchesTile(s.name, top) || matchesTile(s.category, top)),
    )
    if (match) return `${top.label} from ${formatRupees(match.price)}`
  }
  const any = cheapest(salon.services)
  if (any) return `${any.name} from ${formatRupees(any.price)}`
  return salon.priceFrom > 0 ? `From ${formatRupees(salon.priceFrom)}` : null
}

function categoryTags(salon: Salon, max = 2): string[] {
  return tilesMatching(salon.services.flatMap((s) => [s.name, s.category]))
    .slice(0, max)
    .map((tile) => tile.label)
}

/** Vertical list row: 96px photo, name + rating, meta, price line, tags. */
export function SalonListRow({ salon, featured }: { salon: Salon; featured?: boolean }) {
  const router = useRouter()
  const rating = salon.rating > 0 ? salon.rating : null
  const closes = salon.isOpenNow && hasOpeningHours(salon) ? closingTimeLabel(salon.hours) : null
  const openLabel = salon.isOpenNow && hasOpeningHours(salon) ? (closes ? `Open till ${closes}` : "Open now") : null
  const meta = [salonAudienceBadge(salon), formatKm(salon.distanceKm), openLabel].filter(Boolean).join(" · ")
  const price = salonPriceLine(salon)
  const tags = categoryTags(salon)
  const image = salon.coverImageUrl?.trim() || salonProfileImageUrl(salon) || null

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        salon.name,
        rating != null ? `rated ${rating.toFixed(1)}` : null,
        meta || null,
        price,
        featured ? "Featured" : null,
      ]
        .filter(Boolean)
        .join(". ")}
      onPress={() => router.push({ pathname: "/salon/[id]", params: { id: salon.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.image}>
        <PhotoOrFallback uri={image} name={salon.name} />
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {salon.name}
          </Text>
          {rating != null ? (
            <View style={styles.rating}>
              <Text style={styles.ratingText}>{`${rating.toFixed(1)}★`}</Text>
            </View>
          ) : null}
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
        {featured || tags.length > 0 ? (
          <View style={styles.tags}>
            {featured ? (
              <View style={[styles.tag, styles.tagFeatured]}>
                <Text style={[styles.tagText, styles.tagFeaturedText]}>Featured</Text>
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
  tagFeatured: {
    backgroundColor: "#fff1ec",
  },
  tagFeaturedText: {
    color: "#8a3524",
  },
})
