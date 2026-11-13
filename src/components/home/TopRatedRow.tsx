import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"

import { formatKm } from "@/components/home/HomeNextBookingCard"
import { SectionLabel } from "@/components/home/ServiceTiles"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useFavorites } from "@/context/FavoritesContext"
import { salonProfileImageUrl } from "@/data/mocks/salons"
import type { Salon } from "@/data/types"
import { hasOpeningHours, salonAudienceBadge, salonTopServicesLabel } from "@/lib/home-salon-info"
import { fontFamily } from "@/theme/tokens"

const CARD_WIDTH = 236

/** "TOP RATED NEAR YOU": horizontal salon cards. `salons` should already be sorted. */
export function TopRatedRow({ salons, onSeeAll }: { salons: Salon[]; onSeeAll: () => void }) {
  if (salons.length === 0) return null
  return (
    <View style={styles.section}>
      <View style={styles.labelPad}>
        <SectionLabel title="Top rated near you" onSeeAll={onSeeAll} />
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + 14}
        snapToAlignment="start"
        disableIntervalMomentum
      >
        {salons.map((salon) => (
          <TopRatedCard key={salon.id} salon={salon} />
        ))}
      </ScrollView>
    </View>
  )
}

function TopRatedCard({ salon }: { salon: Salon }) {
  const router = useRouter()
  const { isFavorite, toggle } = useFavorites()
  const image = salon.coverImageUrl?.trim() || salonProfileImageUrl(salon)
  const badge = salonAudienceBadge(salon)
  const showOpen = salon.isOpenNow && hasOpeningHours(salon)
  const saved = isFavorite(salon.id)
  const meta = [formatKm(salon.distanceKm), salonTopServicesLabel(salon)].filter(Boolean).join(" · ")

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${salon.name}, rated ${salon.rating.toFixed(1)}. ${meta}`}
      onPress={() => router.push({ pathname: "/salon/[id]", params: { id: salon.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.image, styles.imageFallback]} />
        )}
        {badge ? (
          <View style={[styles.pill, styles.badge]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${salon.name} from saved` : `Save ${salon.name}`}
          hitSlop={8}
          onPress={() => {
            void toggle(salon.id).then((result) => {
              if (result === "auth") router.push("/login")
            })
          }}
          style={styles.heart}
        >
          <Icon name={saved ? "heart" : "heart-outline"} size={17} color={saved ? "#e5484d" : "#111111"} />
        </Pressable>
        {showOpen ? (
          <View style={[styles.pill, styles.open]}>
            <View style={styles.openDot} />
            <Text style={styles.openText}>Open now</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {salon.name}
        </Text>
        <View style={styles.rating}>
          <Text style={styles.ratingText}>{`${salon.rating.toFixed(1)}★`}</Text>
        </View>
      </View>
      {meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
    marginBottom: 8,
  },
  labelPad: {
    paddingHorizontal: 20,
  },
  row: {
    paddingHorizontal: 20,
    gap: 14,
  },
  card: {
    width: CARD_WIDTH,
  },
  pressed: {
    opacity: 0.85,
  },
  imageWrap: {
    height: 150,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#f2f2f2",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    backgroundColor: "#f2f2f2",
  },
  pill: {
    position: "absolute",
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    top: 10,
    left: 10,
    backgroundColor: "#ffffff",
  },
  badgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: "#111111",
  },
  heart: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  open: {
    left: 10,
    bottom: 10,
    backgroundColor: "rgba(17,17,17,0.82)",
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ade80",
  },
  openText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: "#ffffff",
  },
  nameRow: {
    marginTop: 10,
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
    backgroundColor: "#ecf8f2",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  ratingText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: "#1f7a4d",
  },
  meta: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: "#6b6b6b",
  },
})
