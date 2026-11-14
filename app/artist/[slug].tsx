import { StatusBar } from "expo-status-bar"
import { useLocalSearchParams, useRouter, type Href } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ArtistBookBar, BOOK_BAR_GAP, BOOK_BAR_HEIGHT } from "@/components/artist-page/ArtistBookBar"
import { ArtistIntro, type QuickFact } from "@/components/artist-page/ArtistIntro"
import { ArtistPortfolioGrid } from "@/components/artist-page/ArtistPortfolioGrid"
import { ArtistReviewCard } from "@/components/artist-page/ArtistReviewCard"
import { ArtistServiceRow } from "@/components/artist-page/ArtistServiceRow"
import { ArtistServiceSheet } from "@/components/artist-page/ArtistServiceSheet"
import { ArtistTabBar, TAB_BAR_HEIGHT, type ArtistTabKey } from "@/components/artist-page/ArtistTabs"
import { ArtistTopBar } from "@/components/artist-page/ArtistTopBar"
import { ArtistOffersStrip } from "@/components/artists/ArtistOffersStrip"
import { SalonGalleryLightbox } from "@/components/salon/SalonGalleryLightbox"
import { SalonAboutCard, type AboutRow } from "@/components/salon-page/SalonAboutCard"
import { SalonHero } from "@/components/salon-page/SalonHero"
import { ReviewSummary } from "@/components/salon-page/SalonReviews"
import { CHIP_ROW_HEIGHT, SalonCategoryChips } from "@/components/salon-page/SalonTabs"
import { pastels, sp, ui } from "@/components/salon-page/theme"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { SalonDetailSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { useArtistFavorites } from "@/context/ArtistFavoritesContext"
import { useCart } from "@/context/CartContext"
import { artistCartId } from "@/lib/artist-cart"
import { artistLevelLabel, parseArtistLevel } from "@/lib/artist-level"
import {
  artistCategoryLabel,
  fetchPublicArtist,
  type PublicArtist,
  type PublicArtistService,
} from "@/lib/artists-api"
import { isGetQuotesEnabled, isQuoteCategory } from "@/lib/get-quotes"
import { fetchGlammzoOffersForArtist, type GlammzoOfferCard } from "@/lib/glammzo-offers-api"
import { LEGAL } from "@/lib/legal"
import { formatRupees } from "@/lib/service-pricing"
import { fontFamily, spacing } from "@/theme/tokens"

/** Ignore scroll-spy briefly after a tap so the animated scroll doesn't flicker the tabs. */
const SPY_LOCK_MS = 500
const REVIEW_PREVIEW = 3

function placeLine(artist: PublicArtist) {
  return [artist.area, artist.city].filter(Boolean).join(", ")
}

/** Price after a live offer, the same figure the bag uses. */
function bagPrice(service: PublicArtistService) {
  const listPrice = Number(service.price) || 0
  return service.offerPrice != null && service.offerPrice < listPrice ? service.offerPrice : listPrice
}

function travelFeeLine(artist: PublicArtist): string | null {
  if (artist.travelFeeType === "flat" && artist.travelFeeAmount > 0) {
    return `${formatRupees(artist.travelFeeAmount)} travel fee`
  }
  if (artist.travelFeeType === "per_km" && artist.travelFeeAmount > 0) {
    return `${formatRupees(artist.travelFeeAmount)} per km travel fee`
  }
  if (artist.travelFeeType === "none") return "No travel fee"
  return null
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
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [detailService, setDetailService] = useState<PublicArtistService | null>(null)
  const [reviewsOpen, setReviewsOpen] = useState(false)

  // Scroll-driven UI, same as the salon page.
  const [headerSolid, setHeaderSolid] = useState(false)
  const [showStickyTabs, setShowStickyTabs] = useState(false)
  const [showStickyChips, setShowStickyChips] = useState(false)
  const [activeTab, setActiveTab] = useState<ArtistTabKey>("services")
  const [activeCategory, setActiveCategory] = useState("")
  const [headerHeight, setHeaderHeight] = useState(insets.top + 60)

  const scrollRef = useRef<ScrollViewInstance>(null)
  const spyLockUntil = useRef(0)
  const tabBarY = useRef(0)
  const sectionY = useRef<Partial<Record<ArtistTabKey, number>>>({})
  const servicesBottom = useRef(0)
  const chipsLocalY = useRef<number | null>(null)
  const listLocalY = useRef(0)
  const categoryLocalY = useRef<Record<string, number>>({})
  const didFocusPortfolio = useRef(false)

  const safeSlug = (slug ?? "").trim().toLowerCase()
  const cartId = safeSlug ? artistCartId(safeSlug) : ""
  const artistCart = cartId ? cart.getCart(cartId) : undefined
  const selectedServiceIds = artistCart?.serviceIds ?? []
  const wantsPortfolio = (focus ?? "").toLowerCase() === "portfolio"
  const quotesOn = isGetQuotesEnabled()

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

  const portfolio = useMemo(() => artist?.portfolio ?? [], [artist])
  const reviews = artist?.reviews ?? []
  const portfolioImages = useMemo(() => portfolio.map((item) => item.imageUrl).filter(Boolean), [portfolio])
  const heroSlides = useMemo(() => {
    if (portfolioImages.length > 0) return portfolioImages.slice(0, 5)
    const photo = artist?.profilePhotoUrl?.trim()
    return photo ? [photo] : []
  }, [artist?.profilePhotoUrl, portfolioImages])

  /** Services grouped by category, keeping the artist's own order. */
  const serviceGroups = useMemo(() => {
    const groups = new Map<string, PublicArtistService[]>()
    for (const service of artist?.services ?? []) {
      const category = service.category?.trim() || "Services"
      const existing = groups.get(category)
      if (existing) existing.push(service)
      else groups.set(category, [service])
    }
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }))
  }, [artist])
  const categories = useMemo(() => serviceGroups.map((group) => group.category), [serviceGroups])

  const hasAbout = Boolean(
    artist &&
      (artist.bio?.trim() ||
        placeLine(artist) ||
        artist.instagramHandle ||
        artist.cancellationPolicyText ||
        (artist.cancellationPolicyLines?.length ?? 0) > 0),
  )
  const tabs = useMemo<ArtistTabKey[]>(
    () => [
      "services",
      ...(portfolio.length > 0 ? (["portfolio"] as const) : []),
      "reviews",
      ...(hasAbout ? (["about"] as const) : []),
    ],
    [hasAbout, portfolio.length],
  )

  useEffect(() => {
    setActiveCategory(categories[0] ?? "")
    categoryLocalY.current = {}
  }, [categories])

  useEffect(() => {
    if (!wantsPortfolio || loading || !artist || portfolio.length === 0) return
    if (didFocusPortfolio.current) return
    didFocusPortfolio.current = true
    const timer = setTimeout(() => {
      const y = sectionY.current.portfolio
      if (typeof y === "number") scrollToY(y - headerHeight - TAB_BAR_HEIGHT)
      openLightbox(0)
    }, 280)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsPortfolio, loading, artist, portfolio.length])

  function toggleService(service: PublicArtistService) {
    if (!artist || !cartId) return
    cart.toggleService(cartId, service.id, {
      kind: "artist",
      providerName: artist.displayName,
      providerImageUrl: artist.profilePhotoUrl,
      providerArea: artist.area,
      serviceName: service.name,
      servicePrice: bagPrice(service),
      serviceDurationMin: service.durationMinutes,
    })
  }

  const selectedServices = useMemo(() => {
    if (!artist) return []
    return artist.services.filter((s) => selectedServiceIds.includes(s.id))
  }, [artist, selectedServiceIds])

  const selectedTotal = useMemo(
    () => selectedServices.reduce((sum, s) => sum + bagPrice(s), 0),
    [selectedServices],
  )

  function goBook(serviceIds?: string[]) {
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

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/artists" as Href)
  }

  function toggleFavorite() {
    if (!artist) return
    const target = artist
    void (async () => {
      const result = await toggle(target.slug)
      if (result === "auth") {
        router.push({
          pathname: "/login",
          params: { next: `/artist/${target.slug}` },
        } as Href)
      }
    })()
  }

  function shareArtist() {
    if (!artist) return
    const url = `${LEGAL.siteUrl}/a/${encodeURIComponent(artist.slug)}`
    void Share.share(
      Platform.OS === "ios"
        ? { message: `Book ${artist.displayName} on Glammzo`, url }
        : { message: `Book ${artist.displayName} on Glammzo\n${url}`, title: artist.displayName },
    ).catch(() => {})
  }

  function openInstagram() {
    if (!artist?.instagramHandle) return
    void Linking.openURL(`https://instagram.com/${artist.instagramHandle.replace(/^@/, "")}`)
  }

  function openGetQuotes() {
    const category = artist?.categories.find((id) => isQuoteCategory(id))
    router.push({ pathname: "/requests/new", params: category ? { category } : {} } as Href)
  }

  function openLightbox(index: number) {
    if (portfolioImages.length === 0) return
    setLightboxIndex(Math.min(Math.max(0, index), portfolioImages.length - 1))
    setLightboxOpen(true)
  }

  // ---- Scroll geometry (same approach as the salon page) ---------------------

  function categoryY(category: string): number | null {
    const local = categoryLocalY.current[category]
    const services = sectionY.current.services
    if (typeof local !== "number" || typeof services !== "number") return null
    return services + listLocalY.current + local
  }

  function chipsY(): number | null {
    const services = sectionY.current.services
    if (chipsLocalY.current == null || typeof services !== "number") return null
    return services + chipsLocalY.current
  }

  function scrollToY(y: number) {
    spyLockUntil.current = Date.now() + SPY_LOCK_MS
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true })
  }

  function scrollToTab(tab: ArtistTabKey) {
    setActiveTab(tab)
    if (tab === "services") {
      scrollToY(tabBarY.current - headerHeight)
      return
    }
    const y = sectionY.current[tab]
    if (typeof y === "number") scrollToY(y - headerHeight - TAB_BAR_HEIGHT)
  }

  function scrollToCategory(category: string) {
    setActiveCategory(category)
    setActiveTab("services")
    const y = categoryY(category)
    if (y != null) scrollToY(y - headerHeight - TAB_BAR_HEIGHT - CHIP_ROW_HEIGHT - 4)
  }

  function updateScrollUi(y: number, viewportHeight: number, contentHeight: number) {
    const solid = y > Math.max(48, insets.top)
    if (solid !== headerSolid) setHeaderSolid(solid)

    const stickTabs = y + headerHeight >= tabBarY.current && tabBarY.current > 0
    if (stickTabs !== showStickyTabs) setShowStickyTabs(stickTabs)

    const chipsTop = chipsY()
    const pinnedTop = y + headerHeight + TAB_BAR_HEIGHT
    const stickChips =
      stickTabs &&
      chipsTop != null &&
      categories.length > 1 &&
      pinnedTop >= chipsTop &&
      pinnedTop + CHIP_ROW_HEIGHT < servicesBottom.current
    if (stickChips !== showStickyChips) setShowStickyChips(stickChips)

    if (Date.now() < spyLockUntil.current) return

    const probe = pinnedTop + (stickChips ? CHIP_ROW_HEIGHT : 0) + 12
    let nextTab: ArtistTabKey = tabs[0] ?? "services"
    for (const tab of tabs) {
      const top = tab === "services" ? tabBarY.current : sectionY.current[tab]
      if (typeof top === "number" && top <= probe) nextTab = tab
    }
    if (y + viewportHeight >= contentHeight - 4 && y > 0) nextTab = tabs[tabs.length - 1] ?? nextTab
    if (nextTab !== activeTab) setActiveTab(nextTab)

    let nextCategory = categories[0] ?? ""
    for (const category of categories) {
      const top = categoryY(category)
      if (top != null && top <= probe) nextCategory = category
    }
    if (nextCategory !== activeCategory) setActiveCategory(nextCategory)
  }

  function onPageScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent
    updateScrollUi(contentOffset.y, layoutMeasurement.height, contentSize.height)
  }

  // ---- States ----------------------------------------------------------------

  const favorited = artist ? isFavorite(artist.slug) : false

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <SalonDetailSkeleton />
        <ArtistTopBar topInset={insets.top} solid={false} title="Artist" favorited={false} onBack={goBack} />
      </View>
    )
  }

  if (error || !artist) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <ArtistTopBar topInset={insets.top} solid title="Artist" favorited={false} onBack={goBack} />
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Couldn't load artist</Text>
          <Text style={styles.emptyBody}>{error ?? "This booking page isn't available."}</Text>
          <Button label="Go back" onPress={goBack} style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    )
  }

  const where = placeLine(artist)
  const reviewCount = artist.reviewCount ?? reviews.length
  const averageRating = artist.averageRating ?? 0
  const level = parseArtistLevel(artist.level)
  // "Getting started" is the Partner app's wording; customers read it as a new artist.
  const levelName = level === "new" ? "New artist" : artistLevelLabel(level, artist.levelLabel)
  const prices = artist.services.map((service) => service.price).filter((price) => price > 0)
  const startingPrice = prices.length > 0 ? Math.min(...prices) : null
  const studio = artist.services.length === 0 || artist.services.some((service) => service.locationMode !== "client_home")
  const specialities = artist.categories.slice(0, 4).map((id) => artistCategoryLabel(id))
  const travelRadius = artist.offersHomeVisits && artist.serviceRadiusKm > 0 ? artist.serviceRadiusKm : null

  const facts: QuickFact[] = [
    ...(artist.yearsExperience
      ? [{ key: "exp", icon: "ribbon-outline" as const, pastel: pastels.lavender, value: `${artist.yearsExperience}+ yrs`, label: "experience" }]
      : []),
    ...(startingPrice != null
      ? [{ key: "price", icon: "pricetag-outline" as const, pastel: pastels.peach, value: formatRupees(startingPrice), label: "starting price" }]
      : []),
    ...(travelRadius != null
      ? [{ key: "travel", icon: "car-outline" as const, pastel: pastels.sky, value: `${travelRadius} km`, label: "travel radius" }]
      : []),
  ]

  const travelFee = artist.offersHomeVisits ? travelFeeLine(artist) : null
  const policyLines = artist.cancellationPolicyLines ?? []
  const aboutRows: AboutRow[] = [
    ...(where
      ? [
          {
            key: "area",
            icon: "location-outline" as const,
            title: where,
            subtitle: artist.offersHomeVisits
              ? [travelRadius != null ? `Comes to you within ${travelRadius} km` : "Comes to you", travelFee]
                  .filter(Boolean)
                  .join(" · ")
              : "Studio appointments",
          },
        ]
      : []),
    ...(artist.instagramHandle
      ? [
          {
            key: "instagram",
            icon: "logo-instagram" as const,
            title: `@${artist.instagramHandle.replace(/^@/, "")}`,
            subtitle: "Instagram",
            action: { label: "Open", onPress: openInstagram },
          },
        ]
      : []),
    ...(artist.advancePaymentRequired
      ? [
          {
            key: "advance",
            icon: "wallet-outline" as const,
            title: "Advance payment to confirm",
            subtitle: "Paid when you book",
          },
        ]
      : []),
  ]

  const itemCount = selectedServiceIds.length
  const firstItemName = selectedServices[0]?.name
  const showBar = itemCount > 0 || quotesOn
  const bottomPad = showBar ? BOOK_BAR_HEIGHT + BOOK_BAR_GAP + insets.bottom + 24 : insets.bottom + 32
  const darkStatus = headerSolid || heroSlides.length === 0
  const visibleReviews = reviews.slice(0, REVIEW_PREVIEW)
  const bio = artist.bio?.trim()

  return (
    <View style={styles.root}>
      <StatusBar style={darkStatus ? "dark" : "light"} />

      <ArtistTopBar
        topInset={insets.top}
        solid={headerSolid}
        title={artist.displayName}
        favorited={favorited}
        onBack={goBack}
        onShare={shareArtist}
        onToggleFavorite={toggleFavorite}
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height)
          if (next !== headerHeight) setHeaderHeight(next)
        }}
      />

      {showStickyTabs ? (
        <View style={[styles.sticky, { top: headerHeight }]}>
          <ArtistTabBar tabs={tabs} active={activeTab} onSelect={scrollToTab} />
          {showStickyChips ? (
            <View style={styles.stickyChips}>
              <SalonCategoryChips categories={categories} active={activeCategory} onSelect={scrollToCategory} />
            </View>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        onScroll={onPageScroll}
        scrollEventThrottle={16}
      >
        <SalonHero
          slides={heroSlides}
          name={artist.displayName}
          width={width}
          onOpenPhoto={(index) => openLightbox(index)}
        />

        <ArtistIntro
          name={artist.displayName}
          photoUrl={artist.profilePhotoUrl}
          verified={Boolean(artist.isVerified)}
          level={level}
          levelName={levelName}
          rating={averageRating}
          reviewCount={reviewCount}
          specialities={specialities}
          place={where}
          comesToYou={artist.offersHomeVisits}
          studio={studio}
          instagramHandle={artist.instagramHandle}
          facts={facts}
          onPressRating={() => scrollToTab("reviews")}
          onOpenInstagram={openInstagram}
        />

        <View style={styles.offers}>
          <ArtistOffersStrip artistOffers={artist.offers ?? []} services={artist.services} glammzoOffers={offers} />
        </View>

        <View
          style={styles.tabsInFlow}
          onLayout={(event) => {
            tabBarY.current = event.nativeEvent.layout.y
          }}
        >
          <ArtistTabBar tabs={tabs} active={activeTab} onSelect={scrollToTab} />
        </View>

        {/* SERVICES */}
        <View
          onLayout={(event) => {
            sectionY.current.services = event.nativeEvent.layout.y
            servicesBottom.current = event.nativeEvent.layout.y + event.nativeEvent.layout.height
          }}
        >
          {categories.length > 1 ? (
            <View
              onLayout={(event) => {
                chipsLocalY.current = event.nativeEvent.layout.y
              }}
            >
              <SalonCategoryChips categories={categories} active={activeCategory} onSelect={scrollToCategory} />
            </View>
          ) : null}

          <View
            style={styles.serviceList}
            onLayout={(event) => {
              listLocalY.current = event.nativeEvent.layout.y
            }}
          >
            {serviceGroups.length === 0 ? (
              <Text style={styles.emptyText}>No services are open for online booking yet.</Text>
            ) : null}
            {serviceGroups.map((group) => (
              <View
                key={group.category}
                style={styles.category}
                onLayout={(event) => {
                  categoryLocalY.current[group.category] = event.nativeEvent.layout.y
                }}
              >
                <View style={styles.categoryHeader} accessibilityRole="header">
                  <Text style={styles.categoryName}>{group.category}</Text>
                  <Text style={styles.categoryCount}>
                    {group.items.length} {group.items.length === 1 ? "service" : "services"}
                  </Text>
                </View>
                <View style={styles.serviceCard}>
                  {group.items.map((service, index) => (
                    <ArtistServiceRow
                      key={service.id}
                      service={service}
                      selected={selectedServiceIds.includes(service.id)}
                      isLast={index === group.items.length - 1}
                      onOpenDetail={() => setDetailService(service)}
                      onToggle={() => toggleService(service)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* PORTFOLIO */}
        {portfolio.length > 0 ? (
          <View
            onLayout={(event) => {
              sectionY.current.portfolio = event.nativeEvent.layout.y
            }}
          >
            <View style={ui.sectionHead}>
              <Text style={ui.sectionLabel}>Portfolio</Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => openLightbox(0)}>
                <Text style={ui.seeAll}>See all {portfolio.length}</Text>
              </Pressable>
            </View>
            <ArtistPortfolioGrid items={portfolio} width={width} onOpen={openLightbox} />
          </View>
        ) : null}

        {/* REVIEWS */}
        <View
          onLayout={(event) => {
            sectionY.current.reviews = event.nativeEvent.layout.y
          }}
        >
          <View style={ui.sectionHead}>
            <Text style={ui.sectionLabel}>Reviews</Text>
            {reviews.length > REVIEW_PREVIEW ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setReviewsOpen(true)}>
                <Text style={ui.seeAll}>See all {reviews.length}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.reviews}>
            {reviewCount > 0 && averageRating > 0 ? <ReviewSummary rating={averageRating} reviews={reviewCount} /> : null}
            {visibleReviews.length > 0 ? (
              visibleReviews.map((review) => <ArtistReviewCard key={review.id} review={review} />)
            ) : (
              <View style={styles.emptyReviews}>
                <Text style={styles.emptyText}>No reviews yet. Be the first after your booking.</Text>
              </View>
            )}
          </View>
        </View>

        {/* ABOUT */}
        {hasAbout ? (
          <View
            onLayout={(event) => {
              sectionY.current.about = event.nativeEvent.layout.y
            }}
          >
            <View style={ui.sectionHead}>
              <Text style={ui.sectionLabel}>About</Text>
            </View>
            {bio ? <Text style={styles.bio}>{bio}</Text> : null}
            <SalonAboutCard rows={aboutRows} amenities={[]} />
            {artist.cancellationPolicyText || policyLines.length > 0 ? (
              <View style={styles.policyCard}>
                <Text style={ui.sectionLabel}>Cancellation policy</Text>
                {artist.cancellationPolicyText ? (
                  <Text style={styles.policyText}>{artist.cancellationPolicyText}</Text>
                ) : null}
                {policyLines.map((line, index) => (
                  <View key={`${line}-${index}`} style={styles.policyLine}>
                    <View style={styles.policyDot} />
                    <Text style={[styles.policyText, { flex: 1, marginTop: 0 }]}>{line}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <ArtistServiceSheet
        service={detailService}
        selected={detailService ? selectedServiceIds.includes(detailService.id) : false}
        onClose={() => setDetailService(null)}
        onToggle={toggleService}
      />

      <BottomSheet visible={reviewsOpen} title={`Reviews (${reviews.length})`} onClose={() => setReviewsOpen(false)}>
        <View style={styles.allReviews}>
          {reviews.map((review) => (
            <ArtistReviewCard key={review.id} review={review} />
          ))}
        </View>
      </BottomSheet>

      <SalonGalleryLightbox
        visible={lightboxOpen}
        gallery={portfolioImages}
        salonName={artist.displayName}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
      />

      {showBar ? (
        <ArtistBookBar
          bottomInset={insets.bottom}
          itemCount={itemCount}
          totalLabel={formatRupees(selectedTotal)}
          firstItemName={itemCount === 1 ? firstItemName : undefined}
          emptyLine={startingPrice != null ? `Pick a service · from ${formatRupees(startingPrice)}` : "Pick a service to book"}
          onBook={() => (itemCount > 0 ? goBook() : scrollToTab("services"))}
          onClear={() => {
            if (cartId) cart.clearSalon(cartId)
          }}
          onGetQuotes={quotesOn ? openGetQuotes : undefined}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    color: sp.text,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.secondary,
    textAlign: "center",
  },
  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 28,
    backgroundColor: "#ffffff",
  },
  stickyChips: {
    borderBottomWidth: 1,
    borderBottomColor: sp.tabBorder,
  },
  offers: {
    paddingHorizontal: spacing.lg,
    marginTop: 12,
  },
  tabsInFlow: {
    marginTop: 24,
  },
  serviceList: {
    paddingHorizontal: sp.gutter,
  },
  category: {
    paddingTop: 18,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  categoryName: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 23,
    color: sp.text,
  },
  categoryCount: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 17,
    color: sp.secondary,
  },
  serviceCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  emptyText: {
    paddingTop: 20,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.secondary,
  },
  reviews: {
    paddingHorizontal: sp.gutter,
    gap: 12,
  },
  emptyReviews: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.tabBorder,
    borderStyle: "dashed",
  },
  allReviews: {
    gap: 12,
    paddingBottom: 12,
  },
  bio: {
    paddingHorizontal: sp.gutter,
    marginBottom: 14,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: sp.body,
  },
  policyCard: {
    marginTop: 14,
    marginHorizontal: sp.gutter,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    gap: 6,
  },
  policyText: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: sp.body,
  },
  policyLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  policyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
    backgroundColor: sp.secondary,
  },
})
