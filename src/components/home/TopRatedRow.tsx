import { useRouter } from "expo-router"
import { useEffect, useState, type ReactNode } from "react"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import { formatKm } from "@/components/home/HomeNextBookingCard"
import { PhotoOrFallback } from "@/components/home/PhotoFallback"
import { SectionLabel } from "@/components/home/ServiceTiles"
import type { TopArtistsStatus } from "@/components/home/useTopArtists"
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

const EMPTY: Record<DiscoveryKind, { colors: [string, string]; title: string }> = {
  salons: { colors: ["#fff4ef", "#ffe1d6"], title: "No rated salons near you yet" },
  artists: { colors: ["#f7f2ff", "#e6dcff"], title: "No artists near you yet" },
  home: { colors: ["#f1f8fe", "#d9ebfb"], title: "No home-visit artists near you yet" },
}

type Props = {
  salons: Salon[]
  /** Null while loading or when the artists API is unavailable (see `artistsStatus`). */
  artists: ArtistCardData[] | null
  /** Artists who offer home visits (`offersHomeVisits`). */
  homeArtists: ArtistCardData[] | null
  artistsStatus: TopArtistsStatus
  artistLabels: Record<string, string>
  onSeeAll: (kind: DiscoveryKind) => void
}

/** "TOP RATED NEAR YOU": Salons / Artists / At home chips over horizontal cards with page dots. */
export function TopRatedRow({ salons, artists, homeArtists, artistsStatus, artistLabels, onSeeAll }: Props) {
  const [active, setActive] = useState<DiscoveryKind>("salons")

  const artistList = active === "artists" ? artists : active === "home" ? homeArtists : null
  const count = active === "salons" ? salons.length : artistList?.length ?? 0
  const loading = active !== "salons" && artistsStatus === "loading"
  const failed = active !== "salons" && artistsStatus === "error"

  return (
    <View style={styles.section}>
      <View style={styles.labelPad}>
        <SectionLabel title="Top rated near you" onSeeAll={() => onSeeAll(active)} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityRole="tablist"
      >
        {CHIPS.map((chip) => {
          const on = chip.id === active
          return (
            <Pressable
              key={chip.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Top rated ${chip.label.toLowerCase()}`}
              onPress={() => setActive(chip.id)}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && !on && styles.chipPressed]}
            >
              <Icon name={chip.icon} size={15} color={on ? "#ffffff" : "#111111"} />
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{chip.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      {loading ? (
        <SkeletonRow />
      ) : count === 0 ? (
        <EmptyCard kind={active} failed={failed} />
      ) : (
        <Carousel key={active} count={count}>
          {active === "salons"
            ? salons.map((salon) => <SalonCard key={salon.id} salon={salon} />)
            : artistList?.map((artist) => (
                <ArtistTopCard key={artist.slug} artist={artist} labels={artistLabels} />
              ))}
        </Carousel>
      )}
    </View>
  )
}

function EmptyCard({ kind, failed }: { kind: DiscoveryKind; failed: boolean }) {
  const empty = EMPTY[kind]
  const icon = CHIPS.find((chip) => chip.id === kind)?.icon ?? "sparkles-outline"
  const subtitle = failed ? "Couldn't load artists. Pull down to try again." : "We're adding new artists every week."
  return (
    <View style={styles.emptyPad}>
      <View style={styles.empty} accessible accessibilityLabel={`${empty.title}. ${subtitle}`}>
        <GradientFill colors={empty.colors} angle={150} radius={20} />
        <View style={styles.emptyIcon}>
          <Icon name={icon} size={22} color="#111111" />
        </View>
        <Text style={styles.emptyTitle}>{empty.title}</Text>
        <Text style={styles.emptySubtitle}>{subtitle}</Text>
      </View>
    </View>
  )
}

function SkeletonRow() {
  return (
    <ScrollView
      horizontal
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel="Loading artists"
    >
      {[0, 1].map((i) => (
        <View key={i} style={styles.card}>
          <View style={[styles.imageWrap, styles.skeleton]} />
          <View style={styles.textBlock}>
            <View style={[styles.skeletonLine, { width: 180, marginTop: 4 }]} />
            <View style={[styles.skeletonLine, { width: 120, marginTop: 10 }]} />
          </View>
        </View>
      ))}
    </ScrollView>
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
      {/* Fixed-height text block so every card in the row lines up, with or without meta. */}
      <View style={styles.textBlock}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {model.name}
          </Text>
          {model.rating != null ? (
            <View style={styles.rating}>
              <Icon name="star" size={11} color="#17633e" />
              <Text style={styles.ratingText}>{model.rating.toFixed(1)}</Text>
            </View>
          ) : (
            <View style={[styles.rating, styles.ratingNew]}>
              <Text style={[styles.ratingText, styles.ratingNewText]}>New</Text>
            </View>
          )}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {model.meta || " "}
        </Text>
      </View>
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
  // Salons and artists upload square photos: show them 1:1 so nothing is cropped.
  imageWrap: {
    width: CARD_WIDTH,
    aspectRatio: 1,
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
  textBlock: {
    height: 56,
    paddingTop: 10,
    paddingHorizontal: 2,
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
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#e6f5ec",
    borderRadius: 999,
    paddingHorizontal: 8,
  },
  ratingText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: "#17633e",
  },
  ratingNew: {
    backgroundColor: "#f3f3f3",
  },
  ratingNewText: {
    color: "#595959",
  },
  meta: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
  },
  emptyPad: {
    paddingHorizontal: 20,
  },
  empty: {
    height: 160,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: "#111111",
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
    textAlign: "center",
  },
  skeleton: {
    backgroundColor: "#efefef",
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#efefef",
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
