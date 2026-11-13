import { useRouter } from "expo-router"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"

import { formatKm } from "@/components/home/HomeNextBookingCard"
import { PhotoOrFallback } from "@/components/home/PhotoFallback"
import { SectionLabel } from "@/components/home/ServiceTiles"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useArtistFavorites } from "@/context/ArtistFavoritesContext"
import { useFavorites } from "@/context/FavoritesContext"
import { salonProfileImageUrl } from "@/data/mocks/salons"
import type { Salon } from "@/data/types"
import { artistCategoryLabel, type ArtistCardData } from "@/lib/artists-api"
import { hasOpeningHours, salonAudienceBadge, salonTopServicesLabel } from "@/lib/home-salon-info"
import { fontFamily } from "@/theme/tokens"

const CARD_WIDTH = 280
const CARD_GAP = 12
const SNAP = CARD_WIDTH + CARD_GAP
const MAX_DOTS = 5

export type DiscoveryKind = "salons" | "artists" | "home"

const CHIPS: Array<{ id: DiscoveryKind; label: string; icon: IconName }> = [
  { id: "salons", label: "Salons", icon: "business-outline" },
  { id: "artists", label: "Artists", icon: "person-outline" },
  { id: "home", label: "At home", icon: "home-outline" },
]

type Props = {
  salons: Salon[]
  /** Null when the artists API is unavailable: the Artists and At home chips are hidden. */
  artists: ArtistCardData[] | null
  /** Artists who offer home visits (`offersHomeVisits`). */
  homeArtists: ArtistCardData[] | null
  artistLabels: Record<string, string>
  onSeeAll: (kind: DiscoveryKind) => void
}

/** "TOP RATED NEAR YOU": Salons / Artists / At home chips over horizontal cards with page dots. */
export function TopRatedRow({ salons, artists, homeArtists, artistLabels, onSeeAll }: Props) {
  const available = useMemo(
    () =>
      CHIPS.filter((chip) => {
        if (chip.id === "salons") return salons.length > 0
        if (chip.id === "artists") return (artists?.length ?? 0) > 0
        return (homeArtists?.length ?? 0) > 0
      }),
    [salons.length, artists, homeArtists],
  )
  const [kind, setKind] = useState<DiscoveryKind>("salons")
  const active = available.some((chip) => chip.id === kind) ? kind : available[0]?.id

  if (!active) return null

  const count =
    active === "salons" ? salons.length : active === "artists" ? artists?.length ?? 0 : homeArtists?.length ?? 0

  return (
    <View style={styles.section}>
      <View style={styles.labelPad}>
        <SectionLabel title="Top rated near you" onSeeAll={() => onSeeAll(active)} />
      </View>
      {available.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          accessibilityRole="tablist"
        >
          {available.map((chip) => {
            const on = chip.id === active
            return (
              <Pressable
                key={chip.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Top rated ${chip.label.toLowerCase()}`}
                onPress={() => setKind(chip.id)}
                style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && !on && styles.chipPressed]}
              >
                <Icon name={chip.icon} size={15} color={on ? "#ffffff" : "#111111"} />
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{chip.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : null}
      <Carousel key={active} count={count}>
        {active === "salons"
          ? salons.map((salon) => <SalonCard key={salon.id} salon={salon} />)
          : (active === "artists" ? artists : homeArtists)?.map((artist) => (
              <ArtistTopCard key={artist.slug} artist={artist} labels={artistLabels} />
            ))}
      </Carousel>
    </View>
  )
}

function Carousel({ count, children }: { count: number; children: ReactNode }) {
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [count])
  const dots = Math.min(count, MAX_DOTS)

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.max(0, Math.min(count - 1, Math.round(event.nativeEvent.contentOffset.x / SNAP)))
    if (next !== index) setIndex(next)
  }

  // With more cards than dots, spread the position over the dots.
  const activeDot = count <= MAX_DOTS ? index : Math.round((index * (dots - 1)) / Math.max(count - 1, 1))

  return (
    <>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        decelerationRate="fast"
        snapToInterval={SNAP}
        snapToAlignment="start"
        disableIntervalMomentum
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {children}
      </ScrollView>
      {dots > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: dots }, (_, i) => (
            <View key={i} style={[styles.dot, i === activeDot && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </>
  )
}

type CardModel = {
  name: string
  image: string | null
  badge: string | null
  showOpen: boolean
  rating: number | null
  meta: string
  saved: boolean
  onPress: () => void
  onToggleSave: () => void
}

function SalonCard({ salon }: { salon: Salon }) {
  const router = useRouter()
  const { isFavorite, toggle } = useFavorites()
  return (
    <TopCard
      model={{
        name: salon.name,
        image: salon.coverImageUrl?.trim() || salonProfileImageUrl(salon) || null,
        badge: salonAudienceBadge(salon),
        showOpen: Boolean(salon.isOpenNow && hasOpeningHours(salon)),
        rating: salon.rating > 0 ? salon.rating : null,
        meta: [formatKm(salon.distanceKm), salonTopServicesLabel(salon)].filter(Boolean).join(" · "),
        saved: isFavorite(salon.id),
        onPress: () => router.push({ pathname: "/salon/[id]", params: { id: salon.id } }),
        onToggleSave: () => {
          void toggle(salon.id).then((result) => {
            if (result === "auth") router.push("/login")
          })
        },
      }}
    />
  )
}

function ArtistTopCard({ artist, labels }: { artist: ArtistCardData; labels: Record<string, string> }) {
  const router = useRouter()
  const { isFavorite, toggle } = useArtistFavorites()
  const categories = artist.categories
    .slice(0, 2)
    .map((id) => artistCategoryLabel(id, labels))
    .join(", ")
  return (
    <TopCard
      model={{
        name: artist.displayName,
        image: artist.profilePhotoUrl?.trim() || artist.portfolio.find(Boolean) || null,
        badge: artist.offerBadge?.trim() || (artist.offersHomeVisits ? "Home visits" : null),
        showOpen: false,
        rating: (artist.reviewCount ?? 0) > 0 && artist.averageRating ? artist.averageRating : null,
        meta: [formatKm(artist.distanceKm), categories || null].filter(Boolean).join(" · "),
        saved: isFavorite(artist.slug),
        onPress: () =>
          router.push({ pathname: "/artist/[slug]", params: { slug: artist.slug, name: artist.displayName } }),
        onToggleSave: () => {
          void toggle(artist.slug).then((result) => {
            if (result === "auth") router.push("/login")
          })
        },
      }}
    />
  )
}

function TopCard({ model }: { model: CardModel }) {
  const ratingLabel = model.rating != null ? `rated ${model.rating.toFixed(1)}` : "new"
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${model.name}, ${ratingLabel}. ${model.meta}`}
      onPress={model.onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <PhotoOrFallback uri={model.image} name={model.name} />
        {model.badge ? (
          <View style={[styles.pill, styles.badge]}>
            <Text style={styles.badgeText}>{model.badge}</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.saved ? `Remove ${model.name} from saved` : `Save ${model.name}`}
          hitSlop={6}
          onPress={model.onToggleSave}
          style={styles.heart}
        >
          <Icon
            name={model.saved ? "heart" : "heart-outline"}
            size={18}
            color={model.saved ? "#e5484d" : "#111111"}
          />
        </Pressable>
        {model.showOpen ? (
          <View style={[styles.pill, styles.open]}>
            <View style={styles.openDot} />
            <Text style={styles.openText}>Open now</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {model.name}
        </Text>
        {model.rating != null ? (
          <View style={styles.rating}>
            <Text style={styles.ratingText}>{`${model.rating.toFixed(1)}★`}</Text>
          </View>
        ) : null}
      </View>
      {model.meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {model.meta}
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
  chips: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipOn: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
  chipPressed: {
    backgroundColor: "#f6f6f6",
  },
  chipText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: "#111111",
  },
  chipTextOn: {
    color: "#ffffff",
  },
  row: {
    paddingHorizontal: 20,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
  },
  pressed: {
    opacity: 0.85,
  },
  imageWrap: {
    height: 160,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#f2f2f2",
  },
  pill: {
    position: "absolute",
    paddingVertical: 5,
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
    fontSize: 12,
    lineHeight: 16,
    color: "#111111",
  },
  heart: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
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
    fontSize: 12,
    lineHeight: 16,
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
  dots: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#d4d4d4",
  },
  dotOn: {
    width: 16,
    backgroundColor: "#111111",
  },
})
