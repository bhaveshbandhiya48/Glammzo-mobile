import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from "react-native"
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useFavorites } from "@/context/FavoritesContext"
import { getSalonCardImages } from "@/data/mocks/salons"
import type { Salon } from "@/data/types"
import { colors, radii, shadows, spacing } from "@/theme/tokens"

type Props = {
  salon: Salon
  onPress: () => void
  /** grid = explore 2-col; list = full-width overlay card; carousel = map strip. */
  layout?: "grid" | "list" | "carousel"
  /** Emphasize the focused card in the map carousel. */
  active?: boolean
}

function ListCardGradient({ gradientId }: { gradientId: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity="0" />
          <Stop offset="0.35" stopColor="#000000" stopOpacity="0.08" />
          <Stop offset="0.62" stopColor="#000000" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.88" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
  )
}

function CardImageSlider({
  images,
  salonName,
  onPress,
  dotsRaised = false,
  swipeEnabled = true,
}: {
  images: string[]
  salonName: string
  onPress: () => void
  /** Lift dots above the text overlay on list cards. */
  dotsRaised?: boolean
  /** When false, show cover only — parent carousel owns horizontal swipes. */
  swipeEnabled?: boolean
}) {
  const scrollRef = useRef<ScrollViewInstance>(null)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [index, setIndex] = useState(0)
  const dragStartX = useRef(0)
  const didSwipe = useRef(false)
  const hasMultiple = swipeEnabled && images.length > 1

  // [last, ...images, first] so swiping past either end can loop.
  const loopSlides = useMemo(() => {
    if (!hasMultiple) return images
    return [images[images.length - 1]!, ...images, images[0]!]
  }, [hasMultiple, images])

  useEffect(() => {
    if (!hasMultiple || width <= 0) return
    // Land on the first real slide (offset by the leading clone).
    scrollRef.current?.scrollTo({ x: width, animated: false })
    setIndex(0)
  }, [hasMultiple, width, images.length])

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width <= 0 || !hasMultiple) return
    let next = Math.round(event.nativeEvent.contentOffset.x / width)

    if (next <= 0) {
      // Leading clone → jump to real last
      scrollRef.current?.scrollTo({ x: width * images.length, animated: false })
      setIndex(images.length - 1)
      return
    }
    if (next >= images.length + 1) {
      // Trailing clone → jump to real first
      scrollRef.current?.scrollTo({ x: width, animated: false })
      setIndex(0)
      return
    }

    setIndex(next - 1)
  }

  function handlePress() {
    if (didSwipe.current) return
    onPress()
  }

  if (images.length === 0) {
    return <View style={[styles.image, styles.imageFallback]} />
  }

  if (!hasMultiple) {
    return (
      <Pressable onPress={onPress} style={styles.imageFill}>
        <Image
          source={{ uri: images[0] }}
          style={styles.image}
          contentFit="cover"
          accessibilityLabel={`${salonName} photo`}
        />
      </Pressable>
    )
  }

  return (
    <View
      style={styles.imageFill}
      onLayout={(event) => {
        const nextW = Math.round(event.nativeEvent.layout.width)
        const nextH = Math.round(event.nativeEvent.layout.height)
        if (nextW > 0 && nextW !== width) setWidth(nextW)
        if (nextH > 0 && nextH !== height) setHeight(nextH)
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        bounces
        decelerationRate="fast"
        onScrollBeginDrag={(event) => {
          didSwipe.current = false
          dragStartX.current = event.nativeEvent.contentOffset.x
        }}
        onScroll={(event) => {
          const delta = Math.abs(
            event.nativeEvent.contentOffset.x - dragStartX.current,
          )
          if (delta > 8) didSwipe.current = true
        }}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
      >
        {loopSlides.map((uri, i) => (
          <Pressable
            key={`${uri}-loop-${i}`}
            onPress={handlePress}
            style={{ width: width || undefined, flexGrow: width ? 0 : 1 }}
          >
            <Image
              source={{ uri }}
              style={[
                styles.image,
                width > 0 && height > 0 ? { width, height } : null,
              ]}
              contentFit="cover"
              accessibilityLabel={`${salonName} photo`}
            />
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.dots, dotsRaised && styles.dotsRaised]} pointerEvents="none">
        {images.map((uri, i) => (
          <View
            key={`${uri}-dot-${i}`}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  )
}

function FavoriteButton({ salonId }: { salonId: string }) {
  const router = useRouter()
  const { isFavorite, toggle } = useFavorites()
  const favorited = isFavorite(salonId)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={favorited ? "Remove favorite" : "Save salon"}
      hitSlop={8}
      onPress={() => {
        void (async () => {
          const result = await toggle(salonId)
          if (result === "auth") {
            router.push({
              pathname: "/login",
              params: { next: `/salon/${salonId}` },
            })
          }
        })()
      }}
      style={styles.heart}
    >
      <Icon
        name={favorited ? "heart" : "heart-outline"}
        size={16}
        color={favorited ? colors.coral : colors.text}
      />
    </Pressable>
  )
}

function offerLabel(offer: NonNullable<Salon["offers"][number]>) {
  return offer.discountType === "percent"
    ? `${offer.discountValue}% OFF`
    : `₹${offer.discountValue} OFF`
}

export function SalonCard({ salon, onPress, layout = "grid", active = false }: Props) {
  const offer = salon.offers.find((item) => item.isActive)
  const isCarousel = layout === "carousel"
  const isList = layout === "list"
  const showFeaturedBadge = isCarousel && salon.isFeatured === true
  const images = useMemo(() => getSalonCardImages(salon), [salon])

  if (isList) {
    return (
      <View style={[styles.cardShadow, styles.cardList, active && styles.cardActive]}>
        <View style={styles.cardInner}>
          <View style={styles.imageWrapList}>
            <CardImageSlider
              images={images}
              salonName={salon.name}
              onPress={onPress}
              dotsRaised
            />

            <View style={styles.listGradient} pointerEvents="none">
              <ListCardGradient gradientId={`list-scrim-${salon.id}`} />
            </View>

            {offer ? (
              <View style={[styles.offerBadge, styles.offerBadgeList]} pointerEvents="none">
                <Text variant="caption" color={colors.primaryFg}>
                  {offerLabel(offer)}
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.listOpenBadge,
                !salon.isOpenNow && styles.listOpenBadgeClosed,
              ]}
              pointerEvents="none"
            >
              <Text variant="caption" color={colors.primaryFg}>
                {salon.isOpenNow ? "Open now" : "Closed"}
              </Text>
            </View>

            <FavoriteButton salonId={salon.id} />

            <Pressable
              accessibilityRole="button"
              onPress={onPress}
              style={({ pressed }) => [styles.listOverlay, pressed && styles.pressed]}
            >
              <View style={styles.listOverlayCopy}>
                <Text variant="caption" color="rgba(255,255,255,0.88)" numberOfLines={1}>
                  {salon.area}
                  {salon.distanceKm > 0 ? ` · ${salon.distanceKm.toFixed(1)} km` : ""}
                </Text>
                <Text
                  variant="heading"
                  color={colors.primaryFg}
                  numberOfLines={1}
                  style={styles.listTitle}
                >
                  {salon.name}
                </Text>
                <View style={styles.listMetaRow}>
                  <View style={styles.ratingPill}>
                    <Text variant="caption" color={colors.primaryFg}>
                      ★ {salon.rating.toFixed(1)}
                    </Text>
                  </View>
                  <Text variant="caption" color="rgba(255,255,255,0.9)">
                    from ₹{salon.priceFrom}
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View
      style={[
        styles.cardShadow,
        isCarousel ? styles.cardCarousel : styles.cardGrid,
        active && styles.cardActive,
      ]}
    >
      <View style={styles.cardInner}>
      <View style={[styles.imageWrap, isCarousel && styles.imageWrapCarousel]}>
        <CardImageSlider
          images={images}
          salonName={salon.name}
          onPress={onPress}
          swipeEnabled={!isCarousel}
        />
        {showFeaturedBadge || offer ? (
          <View style={styles.badgeStack} pointerEvents="none">
            {showFeaturedBadge ? (
              <View style={styles.featuredBadge}>
                <View style={styles.featuredDot} />
                <Text variant="caption" color={colors.primaryFg}>
                  Featured
                </Text>
              </View>
            ) : null}
            {offer ? (
              <View style={styles.offerBadge}>
                <Text variant="caption" color={colors.primaryFg}>
                  {offerLabel(offer)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <FavoriteButton salonId={salon.id} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.body,
          isCarousel && styles.bodyCarousel,
          pressed && styles.pressed,
        ]}
      >
        <Text variant={isCarousel ? "heading" : "bodyStrong"} numberOfLines={1}>
          {salon.name}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {salon.area}
          {salon.distanceKm > 0 ? ` · ${salon.distanceKm.toFixed(1)} km` : ""}
        </Text>
        <View style={[styles.metaRow, isCarousel && styles.metaRowCarousel]}>
          <View style={styles.ratingPill}>
            <Text variant="caption" color={colors.primaryFg}>
              ★ {salon.rating.toFixed(1)}
            </Text>
          </View>
          <Text
            variant="caption"
            color={salon.isOpenNow ? colors.success : colors.textSubtle}
            numberOfLines={1}
            style={styles.openStatus}
          >
            {salon.isOpenNow ? "Open" : "Closed"}
          </Text>
        </View>
        <Text variant={isCarousel ? "heading" : "bodyStrong"}>
          from ₹{salon.priceFrom}
        </Text>
      </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  cardShadow: {
    borderRadius: radii.lg,
    backgroundColor: "#FFFFFF",
    ...shadows.card,
  },
  cardInner: {
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  cardGrid: {
    width: "48%",
  },
  cardList: {
    width: "100%",
  },
  cardCarousel: {
    width: "100%",
  },
  cardActive: {
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.coral,
  },
  pressed: {
    opacity: 0.94,
  },
  imageWrap: {
    height: 120,
    backgroundColor: colors.muted,
    overflow: "hidden",
  },
  imageWrapList: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.muted,
    overflow: "hidden",
  },
  imageWrapCarousel: {
    height: 96,
    aspectRatio: undefined,
  },
  imageFill: {
    ...StyleSheet.absoluteFill,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    backgroundColor: colors.muted,
  },
  dots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    zIndex: 3,
  },
  dotsRaised: {
    bottom: 92,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  dotActive: {
    width: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  listGradient: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  listOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  listOverlayCopy: {
    gap: 4,
  },
  listTitle: {
    fontSize: 20,
  },
  listMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: 4,
  },
  listOpenBadge: {
    position: "absolute",
    left: spacing.sm,
    top: spacing.sm,
    zIndex: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
  },
  listOpenBadgeClosed: {
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  badgeStack: {
    position: "absolute",
    left: spacing.sm,
    top: spacing.sm,
    zIndex: 2,
    gap: 4,
    alignItems: "flex-start",
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.62)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  featuredDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
  },
  offerBadge: {
    backgroundColor: colors.coral,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  offerBadgeList: {
    position: "absolute",
    left: spacing.sm,
    // Sit below the Open/Closed chip on list cards.
    top: 40,
    zIndex: 2,
  },
  heart: {
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  body: {
    padding: spacing.md,
    gap: 4,
  },
  bodyCarousel: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 6,
    rowGap: 2,
    marginTop: 2,
  },
  metaRowCarousel: {
    marginTop: 2,
  },
  openStatus: {
    flexShrink: 0,
  },
  ratingPill: {
    backgroundColor: colors.success,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
})
