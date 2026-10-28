import { Image } from "expo-image"
import { useLocalSearchParams, useRouter, type Href } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ArtistLevelBadge } from "@/components/artists/ArtistLevelBadge"
import { ArtistOffersStrip } from "@/components/artists/ArtistOffersStrip"
import { ArtistVerifiedBadge } from "@/components/artists/ArtistVerifiedBadge"
import { ArtistServiceRow } from "@/components/artists/ArtistServiceRow"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { CartStrip } from "@/components/ui/CartStrip"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useArtistFavorites } from "@/context/ArtistFavoritesContext"
import { useCart } from "@/context/CartContext"
import { artistCartId } from "@/lib/artist-cart"
import {
  artistLevelLabel,
  parseArtistLevel,
} from "@/lib/artist-level"
import {
  fetchPublicArtist,
  type PublicArtist,
  type PublicArtistService,
} from "@/lib/artists-api"
import {
  fetchGlammzoOffersForArtist,
  type GlammzoOfferCard,
} from "@/lib/glammzo-offers-api"
import { formatRupees } from "@/lib/service-pricing"
import { colors, radii, shadows, spacing } from "@/theme/tokens"

function locationLabel(mode: PublicArtistService["locationMode"]) {
  if (mode === "both") return "Artist's studio or they can come to you"
  if (mode === "studio") return "At the artist's studio"
  return "Artist comes to your home"
}

function placeLine(artist: PublicArtist) {
  return [artist.area, artist.city].filter(Boolean).join(", ")
}

export default function ArtistDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { slug, focus } = useLocalSearchParams<{ slug?: string; focus?: string }>()
  const { isFavorite, toggle } = useArtistFavorites()
  const cart = useCart()
  const [artist, setArtist] = useState<PublicArtist | null>(null)
  const [offers, setOffers] = useState<GlammzoOfferCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [detailService, setDetailService] = useState<PublicArtistService | null>(null)
  const scrollRef = useRef<ScrollViewInstance>(null)
  const portfolioY = useRef(0)
  const reviewsY = useRef(0)
  const didFocusPortfolio = useRef(false)

  const safeSlug = (slug ?? "").trim().toLowerCase()
  const cartId = safeSlug ? artistCartId(safeSlug) : ""
  const artistCart = cartId ? cart.getCart(cartId) : undefined
  const selectedServiceIds = artistCart?.serviceIds ?? []
  const wantsPortfolio = (focus ?? "").toLowerCase() === "portfolio"

  useEffect(() => {
    if (!safeSlug) {
      setError("Artist not found.")
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    didFocusPortfolio.current = false
    void fetchPublicArtist(safeSlug)
      .then((data) => {
        if (!cancelled) {
          setArtist(data)
          void fetchGlammzoOffersForArtist({
            city: data.city,
            area: data.area,
          }).then((next) => {
            if (!cancelled) setOffers(next)
          })
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load artist.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [safeSlug])

  const portfolio = artist?.portfolio ?? []
  const reviews = artist?.reviews ?? []
  /** Single-row slider preview; View all after this many thumbs. */
  const PORTFOLIO_PREVIEW = 5
  const portfolioThumb = Math.floor((width - spacing.lg * 2 - spacing.sm * 3) / 3.4)
  const portfolioPreview = portfolio.slice(0, PORTFOLIO_PREVIEW)
  const portfolioExtra = Math.max(0, portfolio.length - PORTFOLIO_PREVIEW)
  const showPortfolioViewAll = portfolio.length > PORTFOLIO_PREVIEW
  const portfolioImages = useMemo(
    () => portfolio.map((item) => item.imageUrl).filter(Boolean),
    [portfolio],
  )

  useEffect(() => {
    if (!wantsPortfolio || loading || !artist || portfolio.length === 0) return
    if (didFocusPortfolio.current) return
    didFocusPortfolio.current = true
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, portfolioY.current - spacing.md), animated: true })
      setLightboxIndex(0)
    }, 280)
    return () => clearTimeout(timer)
  }, [wantsPortfolio, loading, artist, portfolio.length])

  function toggleService(service: PublicArtistService) {
    if (!artist || !cartId) return
    const listPrice = Number(service.price) || 0
    const offerPrice =
      service.offerPrice != null && service.offerPrice < listPrice
        ? service.offerPrice
        : listPrice
    cart.toggleService(cartId, service.id, {
      kind: "artist",
      providerName: artist.displayName,
      providerImageUrl: artist.profilePhotoUrl,
      providerArea: artist.area,
      serviceName: service.name,
      servicePrice: offerPrice,
      serviceDurationMin: service.durationMinutes,
    })
  }

  const selectedServices = useMemo(() => {
    if (!artist) return []
    return artist.services.filter((s) => selectedServiceIds.includes(s.id))
  }, [artist, selectedServiceIds])

  const selectedTotal = useMemo(
    () =>
      selectedServices.reduce((sum, s) => {
        const listPrice = Number(s.price) || 0
        const offerPrice =
          s.offerPrice != null && s.offerPrice < listPrice ? s.offerPrice : listPrice
        return sum + offerPrice
      }, 0),
    [selectedServices],
  )

  const cartPreviewLabel = useMemo(() => {
    if (selectedServices.length === 0) return undefined
    if (selectedServices.length === 1) return selectedServices[0]?.name
    return `${selectedServices.length} services`
  }, [selectedServices])

  const goBook = (serviceIds?: string[]) => {
    if (!artist) return
    const ids = (serviceIds ?? selectedServiceIds).filter(Boolean)
    if (ids.length === 0) return
    router.push({
      pathname: "/artist/book/[slug]",
      params: {
        slug: artist.slug,
        serviceIds: ids.join(","),
      },
    } as Href)
  }

  const favorited = artist ? isFavorite(artist.slug) : false

  const header = useMemo(
    () => (
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/artists" as Href))}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {artist?.displayName ?? "Artist"}
        </Text>
        <Pressable
          onPress={() => {
            if (!artist) return
            void (async () => {
              const result = await toggle(artist.slug)
              if (result === "auth") {
                router.push({
                  pathname: "/login",
                  params: { next: `/artist/${artist.slug}` },
                } as Href)
              }
            })()
          }}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={favorited ? "Remove favorite" : "Save artist"}
        >
          <Icon
            name={favorited ? "heart" : "heart-outline"}
            size={22}
            color={favorited ? colors.coral : colors.text}
          />
        </Pressable>
      </View>
    ),
    [artist, favorited, insets.top, router, toggle],
  )

  if (loading) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </View>
    )
  }

  if (error || !artist) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.center}>
          <Text variant="heading">Couldn't load artist</Text>
          <Text variant="body" muted style={{ textAlign: "center" }}>
            {error ?? "This booking page isn't available."}
          </Text>
          <Button label="Go back" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    )
  }

  const where = placeLine(artist)
  const reviewCount = artist.reviewCount ?? reviews.length
  const averageRating = artist.averageRating ?? 0
  const level = parseArtistLevel(artist.level)
  const levelLabel = artistLevelLabel(level, artist.levelLabel)
  const showVerified = artist.isVerified !== false

  return (
    <View style={styles.root}>
      {header}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + (selectedServiceIds.length > 0 ? 120 : 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            {artist.profilePhotoUrl ? (
              <Image source={{ uri: artist.profilePhotoUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text variant="title" color={colors.coral}>
                  {artist.displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.levelOnAvatar} accessibilityLabel={`${levelLabel} level`}>
              <ArtistLevelBadge level={level} size={28} />
            </View>
          </View>
          <View style={styles.nameRow}>
            <Text variant="title" style={styles.nameText} numberOfLines={2}>
              {artist.displayName}
            </Text>
            {showVerified ? <ArtistVerifiedBadge size={20} /> : null}
          </View>
          <Text variant="caption" muted style={{ textAlign: "center" }}>
            {levelLabel}
            {where ? ` · ${where}` : ""}
          </Text>
          {reviewCount > 0 ? (
            <Pressable
              onPress={() => {
                scrollRef.current?.scrollTo({
                  y: Math.max(0, reviewsY.current - spacing.md),
                  animated: true,
                })
              }}
              accessibilityRole="button"
              accessibilityLabel={`${averageRating.toFixed(1)} out of 5, ${reviewCount} reviews. Jump to reviews.`}
              style={({ pressed }) => [styles.ratingRow, pressed && { opacity: 0.7 }]}
            >
              <Text variant="bodyStrong" color={colors.coral}>
                {averageRating.toFixed(1)}/5
              </Text>
              <Text variant="caption" muted>
                · {reviewCount} review{reviewCount === 1 ? "" : "s"}
              </Text>
            </Pressable>
          ) : null}
          {artist.yearsExperience ? (
            <Text variant="caption" muted>
              {artist.yearsExperience}+ years experience
            </Text>
          ) : null}
          {artist.bio ? (
            <Text variant="body" muted style={{ textAlign: "center", marginTop: spacing.sm }}>
              {artist.bio}
            </Text>
          ) : null}
        </View>

        {portfolio.length > 0 ? (
          <View
            style={styles.section}
            onLayout={(e) => {
              portfolioY.current = e.nativeEvent.layout.y
            }}
          >
            <Text variant="heading">Portfolio</Text>
            <Text variant="caption" muted>
              Tap a photo to browse · {portfolio.length} photos
            </Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.portfolioStrip}
            >
              {portfolioPreview.map((item, index) => {
                const uri = item.thumbnailUrl || item.imageUrl
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setLightboxIndex(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Portfolio photo ${index + 1}`}
                  >
                    <Image
                      source={{ uri }}
                      style={{
                        width: portfolioThumb,
                        height: portfolioThumb,
                        borderRadius: radii.md,
                        backgroundColor: colors.muted,
                      }}
                      contentFit="cover"
                    />
                  </Pressable>
                )
              })}
              {showPortfolioViewAll ? (
                <Pressable
                  onPress={() => setLightboxIndex(0)}
                  accessibilityRole="button"
                  accessibilityLabel={`View all ${portfolio.length} portfolio photos`}
                  style={({ pressed }) => [
                    {
                      width: portfolioThumb,
                      height: portfolioThumb,
                      borderRadius: radii.md,
                    },
                    styles.portfolioViewAll,
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  {portfolioExtra > 0 ? (
                    <Text variant="caption" color={colors.coral}>
                      +{portfolioExtra}
                    </Text>
                  ) : null}
                  <Text variant="caption" color={colors.coral}>
                    View all
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        <ArtistOffersStrip
          artistOffers={artist.offers ?? []}
          services={artist.services}
          glammzoOffers={offers}
        />

        <View style={styles.section}>
          <Text variant="heading">Services</Text>
          {artist.services.length === 0 ? (
            <Text variant="body" muted>
              No services are open for online booking yet.
            </Text>
          ) : (
            <View style={styles.serviceList}>
              {artist.services.map((service, index) => (
                <ArtistServiceRow
                  key={service.id}
                  service={service}
                  selected={selectedServiceIds.includes(service.id)}
                  isLast={index === artist.services.length - 1}
                  onOpenDetail={() => setDetailService(service)}
                  onToggle={() => toggleService(service)}
                />
              ))}
            </View>
          )}
        </View>

        {reviewCount > 0 ? (
          <View
            style={styles.section}
            onLayout={(e) => {
              reviewsY.current = e.nativeEvent.layout.y
            }}
          >
            <Text variant="heading">Reviews</Text>
            <Text variant="caption" muted>
              {averageRating.toFixed(1)}/5 · {reviewCount} review
              {reviewCount === 1 ? "" : "s"}
            </Text>
            {(reviews.length > 0 ? reviews : []).slice(0, 8).map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHead}>
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{review.authorName}</Text>
                    <Text variant="caption" muted>
                      {new Date(review.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {review.serviceName ? ` · ${review.serviceName}` : ""}
                    </Text>
                  </View>
                  <View style={styles.ratingPill}>
                    <Text variant="caption" color={colors.primaryFg}>
                      ★ {Number(review.rating).toFixed(1)}
                    </Text>
                  </View>
                </View>
                {review.comment ? (
                  <Text variant="body" muted style={{ marginTop: spacing.sm }}>
                    {review.comment}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {artist.cancellationPolicyText ? (
          <View style={styles.section}>
            <Text variant="heading">Cancellation</Text>
            <Text variant="body" muted>
              {artist.cancellationPolicyText}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet
        visible={detailService != null}
        title="Service summary"
        onClose={() => setDetailService(null)}
      >
        {detailService ? (
          <View style={styles.sheetBody}>
            <Text variant="heading">{detailService.name}</Text>
            <Text muted style={{ marginTop: spacing.xs }}>
              {detailService.category || locationLabel(detailService.locationMode)} ·{" "}
              {detailService.durationMinutes} min
            </Text>
            <View style={styles.sheetPriceBox}>
              <Text variant="caption" muted>
                At artist's studio
              </Text>
              {detailService.offerPrice != null &&
              detailService.offerPrice < detailService.price ? (
                <>
                  <Text variant="caption" muted style={{ textDecorationLine: "line-through" }}>
                    {formatRupees(detailService.price)}
                  </Text>
                  <Text variant="title" color={colors.coral}>
                    {formatRupees(detailService.offerPrice)}
                  </Text>
                  {detailService.offerDealLabel ? (
                    <Text variant="caption" color={colors.coral} style={{ marginTop: 4 }}>
                      {detailService.offerDealLabel}
                      {detailService.offerTitle ? ` · ${detailService.offerTitle}` : ""}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text variant="title">{formatRupees(detailService.price)}</Text>
              )}
              {detailService.homeVisitPriceOverride != null ? (
                <>
                  <Text variant="caption" muted style={{ marginTop: spacing.sm }}>
                    If artist comes to your home
                  </Text>
                  <Text variant="heading">
                    {formatRupees(detailService.homeVisitPriceOverride)}
                  </Text>
                </>
              ) : detailService.locationMode === "client_home" ||
                detailService.locationMode === "both" ? (
                <Text variant="caption" muted style={{ marginTop: 4 }}>
                  Same price for home visits
                </Text>
              ) : null}
            </View>
            {detailService.description ? (
              <Text variant="body" muted style={{ marginTop: spacing.lg }}>
                {detailService.description}
              </Text>
            ) : null}
            <Text variant="caption" muted style={{ marginTop: spacing.md }}>
              {locationLabel(detailService.locationMode)}
            </Text>
            <Button
              label={
                selectedServiceIds.includes(detailService.id)
                  ? "Remove from bag"
                  : "Add to bag"
              }
              variant={
                selectedServiceIds.includes(detailService.id) ? "secondary" : "primary"
              }
              style={{ marginTop: spacing.xxl }}
              onPress={() => {
                toggleService(detailService)
                setDetailService(null)
              }}
            />
          </View>
        ) : null}
      </BottomSheet>

      {selectedServiceIds.length > 0 && artist ? (
        <CartStrip
          entries={[
            {
              salonId: artist.slug,
              salonName: artist.displayName,
              itemCount: selectedServiceIds.length,
              totalLabel: formatRupees(selectedTotal),
              imageUrls: artist.profilePhotoUrl ? [artist.profilePhotoUrl] : [],
              previewLabel: cartPreviewLabel,
              ctaLabel: "Next",
              onPress: () => goBook(),
              onClear: () => {
                if (cartId) cart.clearSalon(cartId)
              },
            },
          ]}
        />
      ) : null}

      <Modal
        visible={lightboxIndex != null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxIndex(null)}
      >
        <View style={[styles.lightbox, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.lightboxBar}>
            <Pressable
              onPress={() => setLightboxIndex(null)}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Close portfolio"
            >
              <Icon name="close" size={24} color={colors.primaryFg} />
            </Pressable>
            <Text variant="bodyStrong" color={colors.primaryFg}>
              {lightboxIndex != null ? `${lightboxIndex + 1} / ${portfolioImages.length}` : ""}
            </Text>
            <View style={styles.iconBtn} />
          </View>
          {lightboxIndex != null && portfolioImages.length > 0 ? (
            <FlatList
              data={portfolioImages}
              keyExtractor={(uri, i) => `${uri}-${i}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={lightboxIndex}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const next = Math.round(e.nativeEvent.contentOffset.x / width)
                if (next >= 0 && next < portfolioImages.length) setLightboxIndex(next)
              }}
              renderItem={({ item: uri }) => (
                <View style={{ width, height: "100%", justifyContent: "center" }}>
                  <Image source={{ uri }} style={styles.lightboxImage} contentFit="contain" />
                </View>
              )}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { padding: spacing.lg, gap: spacing.xl },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  hero: { alignItems: "center", gap: spacing.sm },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.muted,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  levelOnAvatar: {
    position: "absolute",
    right: -2,
    bottom: -2,
    borderRadius: 99,
    backgroundColor: colors.card,
    padding: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    maxWidth: "100%",
    paddingHorizontal: spacing.sm,
  },
  nameText: {
    textAlign: "center",
    flexShrink: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  ratingPill: {
    backgroundColor: colors.coral,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  section: { gap: spacing.md },
  portfolioStrip: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    paddingRight: spacing.sm,
  },
  portfolioViewAll: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8EDE8",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(232, 120, 90, 0.35)",
    gap: 2,
    paddingHorizontal: 4,
  },
  serviceList: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: "hidden",
    ...shadows.card,
  },
  sheetBody: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  sheetPriceBox: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  reviewHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
  },
  lightboxBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
  },
  lightboxImage: { width: "100%", height: "80%" },
})
