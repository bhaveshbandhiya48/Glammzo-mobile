import { StatusBar } from "expo-status-bar"
import { useLocalSearchParams, useRouter } from "expo-router"
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
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AudienceSwitch } from "@/components/home/AudienceSwitch"
import { Button } from "@/components/ui/Button"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { SalonDetailSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { SalonGalleryLightbox } from "@/components/salon/SalonGalleryLightbox"
import { SalonOffersCarousel } from "@/components/salon/SalonOffersCarousel"
import { SalonAboutCard, type AboutRow } from "@/components/salon-page/SalonAboutCard"
import { CART_BAR_GAP, CART_BAR_HEIGHT, SalonCartBar } from "@/components/salon-page/SalonCartBar"
import { SalonPackageSheet, SalonServiceSheet } from "@/components/salon-page/SalonDetailSheets"
import { HERO_HEIGHT, SalonHero } from "@/components/salon-page/SalonHero"
import { SalonIntro, type QuickAction } from "@/components/salon-page/SalonIntro"
import { SalonPackageTile } from "@/components/salon-page/SalonPackageTile"
import { SalonPhotosGrid } from "@/components/salon-page/SalonPhotosGrid"
import { ReviewSummary, SalonReviewCard } from "@/components/salon-page/SalonReviews"
import { SalonServiceRow } from "@/components/salon-page/SalonServiceRow"
import {
  CHIP_ROW_HEIGHT,
  SalonCategoryChips,
  SalonTabBar,
  TAB_BAR_HEIGHT,
  type SalonTabKey,
} from "@/components/salon-page/SalonTabs"
import { SalonTeamRow } from "@/components/salon-page/SalonTeamRow"
import { SalonTopBar } from "@/components/salon-page/SalonTopBar"
import { dialablePhone, parseSalonHours, salonFullGallery, sp, ui } from "@/components/salon-page/theme"
import { useCart } from "@/context/CartContext"
import { useFavorites } from "@/context/FavoritesContext"
import { flattenAmenities, getSalonHeroSlides, salonProfileImageUrl } from "@/data/mocks/salons"
import type { Salon, SalonPackage, SalonService } from "@/data/types"
import { getSalonByIdLive } from "@/lib/salons-api"
import { openDirections } from "@/lib/visit-links"
import { fetchGlammzoOffersForSalon, type GlammzoOfferCard } from "@/lib/glammzo-offers-api"
import { withSalonDistanceFromLocation } from "@/lib/explore-location"
import {
  filterPackagesByGenderAudience,
  filterServicesByGenderAudience,
  isUnisexSalonBusiness,
} from "@/lib/gender-audience"
import { useHomeAudience } from "@/lib/home-audience"
import { hasOpeningHours, salonAudienceBadge } from "@/lib/home-salon-info"
import { LEGAL } from "@/lib/legal"
import { bestOfferForService, formatOfferDiscountBadge } from "@/lib/offer-badges"
import { quantityForService } from "@/lib/pricing-unit"
import { cartServicesSubtotal, defaultPriceOptionId, formatRupees, serviceHasPriceOptions } from "@/lib/service-pricing"
import type { HomeAudience } from "@/lib/service-tiles"
import { getSavedLocation } from "@/lib/user"
import { salonWhatsAppUrl } from "@/lib/whatsapp"
import { fontFamily, spacing } from "@/theme/tokens"

const PACKAGES_CATEGORY = "Packages"
/** Ignore scroll-spy briefly after a tap so the animated scroll doesn't flicker the tabs. */
const SPY_LOCK_MS = 500

export default function SalonDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [salon, setSalon] = useState<Salon | undefined>()
  const [loading, setLoading] = useState(true)
  const cart = useCart()
  const { isFavorite, toggle } = useFavorites()
  const [homeAudience] = useHomeAudience()
  const [pickedAudience, setPickedAudience] = useState<HomeAudience | null>(null)
  const genderAudience = pickedAudience ?? homeAudience
  const [detailService, setDetailService] = useState<SalonService | null>(null)
  const [detailPackage, setDetailPackage] = useState<SalonPackage | null>(null)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [glammzoOffers, setGlammzoOffers] = useState<GlammzoOfferCard[]>([])

  // Scroll-driven UI.
  const [headerSolid, setHeaderSolid] = useState(false)
  const [showStickyTabs, setShowStickyTabs] = useState(false)
  const [showStickyChips, setShowStickyChips] = useState(false)
  const [activeTab, setActiveTab] = useState<SalonTabKey>("services")
  const [activeCategory, setActiveCategory] = useState("")
  const [headerHeight, setHeaderHeight] = useState(insets.top + 60)

  const pageScrollRef = useRef<ScrollViewInstance>(null)
  const spyLockUntil = useRef(0)
  const lastScrollY = useRef(0)
  // Offsets inside the scroll content (y of each block, from onLayout).
  const tabBarY = useRef(0)
  const sectionY = useRef<Partial<Record<SalonTabKey, number>>>({})
  const servicesBottom = useRef(0)
  const chipsLocalY = useRef<number | null>(null)
  const listLocalY = useRef(0)
  const categoryLocalY = useRef<Record<string, number>>({})

  useEffect(() => {
    let active = true
    if (typeof id !== "string") {
      setSalon(undefined)
      setGlammzoOffers([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([getSalonByIdLive(id), getSavedLocation()]).then(([next, location]) => {
      if (!active) return
      const withDistance = next ? withSalonDistanceFromLocation(next, location) : undefined
      setSalon(withDistance)
      setLoading(false)

      if (!withDistance) {
        setGlammzoOffers([])
        return
      }

      void fetchGlammzoOffersForSalon({
        city: withDistance.city,
        area: withDistance.area,
      }).then((offers) => {
        if (active) setGlammzoOffers(offers)
      })
    })
    return () => {
      active = false
    }
  }, [id])

  const isUnisex = isUnisexSalonBusiness(salon?.businessType)
  const salonCart = salon ? cart.getCart(salon.id) : undefined

  const catalogServices = useMemo(() => {
    if (!salon) return []
    if (!isUnisex) return salon.services
    return filterServicesByGenderAudience(salon.services, genderAudience)
  }, [genderAudience, isUnisex, salon])

  const catalogPackages = useMemo(() => {
    if (!salon) return []
    if (!isUnisex) return salon.packages
    return filterPackagesByGenderAudience(salon.packages, salon.services, genderAudience)
  }, [genderAudience, isUnisex, salon])

  const selectedPackage = useMemo(() => {
    if (!salon || !salonCart?.packageId) return undefined
    return salon.packages.find((item) => item.id === salonCart.packageId)
  }, [salon, salonCart])

  const total = salon
    ? cartServicesSubtotal(
        salon.services,
        salonCart?.serviceIds ?? [],
        selectedPackage ?? null,
        salonCart?.quantities,
        salonCart?.priceOptionIds,
      )
    : 0

  /** What the bag would cost at struck-through prices (flat-priced services and the package). */
  const savings = useMemo(() => {
    if (!salon || !salonCart) return 0
    let amount = 0
    for (const serviceId of salonCart.serviceIds) {
      const service = salon.services.find((item) => item.id === serviceId)
      if (!service || serviceHasPriceOptions(service)) continue
      if (service.compareAtPrice && service.compareAtPrice > service.price) {
        amount += (service.compareAtPrice - service.price) * quantityForService(service, salonCart.quantities)
      }
    }
    if (selectedPackage && selectedPackage.showComparePrice !== false && selectedPackage.comparePrice > selectedPackage.packagePrice) {
      amount += selectedPackage.comparePrice - selectedPackage.packagePrice
    }
    return amount
  }, [salon, salonCart, selectedPackage])

  const slides = useMemo(() => (salon ? getSalonHeroSlides(salon, 5) : []), [salon])
  const fullGallery = useMemo(() => (salon ? salonFullGallery(salon) : []), [salon])
  const whatsappUrl = useMemo(
    () =>
      salon
        ? salonWhatsAppUrl(salon.whatsappPhone, `Hi ${salon.name}, I found you on Glammzo and would like to enquire.`)
        : null,
    [salon],
  )
  const amenityRows = useMemo(() => flattenAmenities(salon?.amenities).slice(0, 10), [salon])
  const customerReviews = salon?.customerReviews ?? []

  const serviceGroups = useMemo(() => {
    const groups = new Map<string, SalonService[]>()
    for (const service of catalogServices) {
      const category = service.category.trim() || "Services"
      const existing = groups.get(category)
      if (existing) existing.push(service)
      else groups.set(category, [service])
    }
    return Array.from(groups.entries())
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category))
  }, [catalogServices])

  const catalogCategories = useMemo(() => {
    const categories = serviceGroups.map((group) => group.category)
    if (catalogPackages.length > 0) return [PACKAGES_CATEGORY, ...categories]
    return categories
  }, [catalogPackages.length, serviceGroups])

  const serviceOfferLabels = useMemo(() => {
    const labels = new Map<string, string>()
    if (!salon) return labels
    const activeOffers = salon.offers.filter((item) => item.isActive)
    for (const service of salon.services) {
      const best = bestOfferForService(activeOffers, service.id, service.price)
      if (best) labels.set(service.id, formatOfferDiscountBadge(best))
    }
    return labels
  }, [salon])

  const tabs = useMemo<SalonTabKey[]>(
    () => ["services", ...(fullGallery.length > 0 ? (["photos"] as const) : []), "reviews", "about"],
    [fullGallery.length],
  )

  useEffect(() => {
    setActiveCategory(catalogCategories[0] ?? "")
    categoryLocalY.current = {}
  }, [catalogCategories])

  function handleToggleService(service: SalonService) {
    if (!salon) return
    if (cart.isServiceSelected(salon.id, service.id)) {
      cart.toggleService(salon.id, service.id)
      return
    }
    cart.toggleService(salon.id, service.id, {
      priceOptionId: defaultPriceOptionId(service),
    })
  }

  function handleServiceQuantity(service: SalonService, quantity: number) {
    if (!salon) return
    cart.setServiceQuantity(salon.id, service.id, quantity, service.pricingUnit)
  }

  function handleServicePriceOption(service: SalonService, optionId: string) {
    if (!salon) return
    cart.setServicePriceOption(salon.id, service.id, optionId)
  }

  function togglePackage(pkg: SalonPackage) {
    if (!salon) return
    // setPackage replaces any other package: one package per bag.
    cart.setPackage(salon.id, cart.isPackageSelected(salon.id, pkg.id) ? null : pkg.id)
  }

  // ---- Scroll geometry -------------------------------------------------------

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
    pageScrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true })
  }

  function scrollToTab(tab: SalonTabKey) {
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
      catalogCategories.length > 1 &&
      pinnedTop >= chipsTop &&
      pinnedTop + CHIP_ROW_HEIGHT < servicesBottom.current
    if (stickChips !== showStickyChips) setShowStickyChips(stickChips)

    if (Date.now() < spyLockUntil.current) return

    // The line just under the pinned bars decides what is "current".
    const probe = pinnedTop + (stickChips ? CHIP_ROW_HEIGHT : 0) + 12
    let nextTab: SalonTabKey = tabs[0] ?? "services"
    for (const tab of tabs) {
      const top = tab === "services" ? tabBarY.current : sectionY.current[tab]
      if (typeof top === "number" && top <= probe) nextTab = tab
    }
    // Short last section: count it once the page can't scroll further.
    if (y + viewportHeight >= contentHeight - 4 && y > 0) nextTab = tabs[tabs.length - 1] ?? nextTab
    if (nextTab !== activeTab) setActiveTab(nextTab)

    let nextCategory = catalogCategories[0] ?? ""
    for (const category of catalogCategories) {
      const top = categoryY(category)
      if (top != null && top <= probe) nextCategory = category
    }
    if (nextCategory !== activeCategory) setActiveCategory(nextCategory)
  }

  function onPageScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent
    lastScrollY.current = contentOffset.y
    updateScrollUi(contentOffset.y, layoutMeasurement.height, contentSize.height)
  }

  // ---- States ----------------------------------------------------------------

  if (loading) {
    return <SalonDetailSkeleton />
  }

  if (!salon) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text variant="heading">Salon not found</Text>
        <Button label="Back to Explore" style={{ marginTop: spacing.xl }} onPress={() => router.replace("/(tabs)/explore")} />
      </View>
    )
  }

  const currentSalon = salon
  const favorited = isFavorite(salon.id)
  const itemCount = cart.itemCountFor(salon.id)
  const hasCart = itemCount > 0
  const phone = dialablePhone(salon.phone)
  const hours = parseSalonHours(salon.hours)
  const scheduled = hasOpeningHours(salon)
  const locationLine = [salon.area, salon.city].filter(Boolean).join(", ")
  const subtitle = [salonAudienceBadge(salon), locationLine].filter(Boolean).join(" · ")
  const hasOffers = glammzoOffers.length > 0 || salon.offers.length > 0
  const firstServiceName = (salonCart?.serviceIds ?? [])
    .map((serviceId) => salon.services.find((service) => service.id === serviceId)?.name)
    .find(Boolean)
  const firstItemName = firstServiceName ?? selectedPackage?.name

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/explore")
  }

  function shareSalon() {
    const url = `${LEGAL.siteUrl}/salons/${encodeURIComponent(currentSalon.id)}`
    const message = [
      `Check out ${currentSalon.name} on Glammzo`,
      currentSalon.area ? `${currentSalon.area}${currentSalon.city ? `, ${currentSalon.city}` : ""}` : null,
      url,
    ]
      .filter(Boolean)
      .join("\n")
    void Share.share(Platform.OS === "ios" ? { message, url } : { message, title: currentSalon.name }).catch(() => {
      // User dismissed sheet or share unavailable — ignore.
    })
  }

  function toggleFavorite() {
    void (async () => {
      const result = await toggle(currentSalon.id)
      if (result === "auth") {
        router.push({ pathname: "/login", params: { next: `/salon/${currentSalon.id}` } })
      }
    })()
  }

  function directions() {
    openDirections({
      latitude: currentSalon.latitude,
      longitude: currentSalon.longitude,
      query: currentSalon.address || [currentSalon.name, currentSalon.area, currentSalon.city].filter(Boolean).join(", "),
    })
  }

  function call() {
    if (phone) void Linking.openURL(`tel:${phone}`)
  }

  function openGallery(index: number) {
    setGalleryIndex(index)
    setGalleryOpen(true)
  }

  const quickActions: QuickAction[] = [
    ...(phone ? [{ kind: "call" as const, label: "Call", onPress: call }] : []),
    ...(whatsappUrl
      ? [{ kind: "whatsapp" as const, label: "WhatsApp", onPress: () => void Linking.openURL(whatsappUrl) }]
      : []),
    { kind: "directions", label: "Directions", onPress: directions },
    { kind: "share", label: "Share", onPress: shareSalon },
  ]

  const aboutRows: AboutRow[] = [
    {
      key: "address",
      icon: "location-outline",
      title: salon.address || locationLine || salon.name,
      subtitle: [salon.city, salon.distanceKm > 0 ? `${salon.distanceKm.toFixed(1)} km away` : null].filter(Boolean).join(" · "),
      action: { label: "Directions", onPress: directions },
    },
    ...(scheduled
      ? [
          {
            key: "hours",
            icon: "time-outline" as const,
            title: hours.range
              ? `${salon.isOpenNow ? "Open today" : "Closed now"} · ${hours.range}`
              : salon.hours,
            subtitle: hours.days,
          },
        ]
      : []),
    ...(phone
      ? [
          {
            key: "phone",
            icon: "call-outline" as const,
            title: salon.phone,
            subtitle: "Call the salon",
            action: { label: "Call", onPress: call },
          },
        ]
      : []),
  ]

  const visibleReviews = customerReviews.slice(0, 3)
  const darkStatus = headerSolid || slides.length === 0
  const bottomPad = hasCart ? CART_BAR_HEIGHT + CART_BAR_GAP + insets.bottom + 24 : insets.bottom + 32

  return (
    <View style={styles.root}>
      <StatusBar style={darkStatus ? "dark" : "light"} />

      <SalonTopBar
        topInset={insets.top}
        solid={headerSolid}
        title={salon.name}
        favorited={favorited}
        onBack={goBack}
        onShare={shareSalon}
        onToggleFavorite={toggleFavorite}
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height)
          if (next !== headerHeight) setHeaderHeight(next)
        }}
      />

      {/* Pinned clone of the tab bar (and category chips while in Services). */}
      {showStickyTabs ? (
        <View style={[styles.sticky, { top: headerHeight }]}>
          <SalonTabBar tabs={tabs} active={activeTab} onSelect={scrollToTab} />
          {showStickyChips ? (
            <View style={styles.stickyChips}>
              <SalonCategoryChips categories={catalogCategories} active={activeCategory} onSelect={scrollToCategory} />
            </View>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        ref={pageScrollRef}
        style={styles.root}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onPageScroll}
        scrollEventThrottle={16}
      >
        <SalonHero
          slides={slides}
          name={salon.name}
          width={windowWidth}
          onOpenPhoto={(index) => openGallery(Math.max(0, fullGallery.indexOf(slides[index] ?? "")))}
        />

        <SalonIntro
          name={salon.name}
          subtitle={subtitle}
          rating={salon.rating}
          reviews={salon.reviews}
          status={scheduled ? (salon.isOpenNow ? { open: true, closes: hours.closes } : { open: false }) : null}
          distanceKm={salon.distanceKm}
          actions={quickActions}
          about={salon.description}
          onPressRating={() => scrollToTab("reviews")}
        />

        {hasOffers ? (
          <>
            <View style={ui.sectionHead}>
              <Text style={ui.sectionLabel}>Offers</Text>
            </View>
            <SalonOffersCarousel
              glammzoOffers={glammzoOffers}
              salonOffers={salon.offers}
              onPressCta={() => scrollToTab("services")}
            />
          </>
        ) : null}

        <View
          style={styles.tabsInFlow}
          onLayout={(event) => {
            tabBarY.current = event.nativeEvent.layout.y
          }}
        >
          <SalonTabBar tabs={tabs} active={activeTab} onSelect={scrollToTab} />
        </View>

        {/* SERVICES */}
        <View
          onLayout={(event) => {
            sectionY.current.services = event.nativeEvent.layout.y
            servicesBottom.current = event.nativeEvent.layout.y + event.nativeEvent.layout.height
          }}
        >
          {isUnisex ? (
            <View style={styles.audienceRow}>
              <AudienceSwitch value={genderAudience} onChange={setPickedAudience} />
            </View>
          ) : null}

          {catalogCategories.length > 1 ? (
            <View
              onLayout={(event) => {
                chipsLocalY.current = event.nativeEvent.layout.y
              }}
            >
              <SalonCategoryChips categories={catalogCategories} active={activeCategory} onSelect={scrollToCategory} />
            </View>
          ) : null}

          <View
            style={styles.serviceList}
            onLayout={(event) => {
              listLocalY.current = event.nativeEvent.layout.y
            }}
          >
            {catalogCategories.length === 0 ? (
              <Text style={styles.emptyText}>Services coming soon</Text>
            ) : null}

            {catalogPackages.length > 0 ? (
              <View
                style={styles.category}
                onLayout={(event) => {
                  categoryLocalY.current[PACKAGES_CATEGORY] = event.nativeEvent.layout.y
                }}
              >
                <CategoryHeader name={PACKAGES_CATEGORY} count={catalogPackages.length} />
                <View style={styles.packages}>
                  {catalogPackages.map((pkg, index) => (
                    <SalonPackageTile
                      key={pkg.id}
                      pkg={pkg}
                      index={index}
                      selected={cart.isPackageSelected(salon.id, pkg.id)}
                      onOpen={() => setDetailPackage(pkg)}
                      onToggle={() => togglePackage(pkg)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {serviceGroups.map((group) => (
              <View
                key={group.category}
                style={styles.category}
                onLayout={(event) => {
                  categoryLocalY.current[group.category] = event.nativeEvent.layout.y
                }}
              >
                <CategoryHeader name={group.category} count={group.items.length} />
                {group.items.map((service, index) => (
                  <SalonServiceRow
                    key={service.id}
                    service={service}
                    selected={cart.isServiceSelected(salon.id, service.id)}
                    quantity={quantityForService(service, salonCart?.quantities)}
                    selectedOptionId={salonCart?.priceOptionIds[service.id] ?? null}
                    offerLabel={serviceOfferLabels.get(service.id)}
                    isLast={index === group.items.length - 1}
                    onOpenDetail={() => setDetailService(service)}
                    onToggle={() => handleToggleService(service)}
                    onQuantityChange={(quantity) => handleServiceQuantity(service, quantity)}
                    onPriceOptionChange={(optionId) => handleServicePriceOption(service, optionId)}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* PHOTOS */}
        {fullGallery.length > 0 ? (
          <View
            onLayout={(event) => {
              sectionY.current.photos = event.nativeEvent.layout.y
            }}
          >
            <View style={ui.sectionHead}>
              <Text style={ui.sectionLabel}>Photos</Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => openGallery(0)}>
                <Text style={ui.seeAll}>See all {fullGallery.length}</Text>
              </Pressable>
            </View>
            <SalonPhotosGrid photos={fullGallery} onOpen={openGallery} />
          </View>
        ) : null}

        {/* TEAM */}
        {salon.team.length > 0 ? (
          <View>
            <View style={ui.sectionHead}>
              <Text style={ui.sectionLabel}>Team</Text>
            </View>
            <SalonTeamRow team={salon.team} />
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
            {customerReviews.length > 3 ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setReviewsOpen(true)}>
                <Text style={ui.seeAll}>See all {customerReviews.length}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.reviews}>
            {salon.reviews > 0 ? <ReviewSummary rating={salon.rating} reviews={salon.reviews} /> : null}
            {visibleReviews.length > 0 ? (
              visibleReviews.map((review) => <SalonReviewCard key={review.id} review={review} />)
            ) : (
              <View style={styles.emptyReviews}>
                <Text style={styles.emptyText}>No reviews yet. Be the first after your visit.</Text>
              </View>
            )}
          </View>
        </View>

        {/* ABOUT */}
        <View
          onLayout={(event) => {
            sectionY.current.about = event.nativeEvent.layout.y
          }}
        >
          <View style={ui.sectionHead}>
            <Text style={ui.sectionLabel}>About</Text>
          </View>
          <SalonAboutCard rows={aboutRows} amenities={amenityRows} />
        </View>
      </ScrollView>

      <SalonServiceSheet
        service={detailService}
        selected={detailService ? cart.isServiceSelected(salon.id, detailService.id) : false}
        quantities={salonCart?.quantities}
        priceOptionId={detailService ? salonCart?.priceOptionIds[detailService.id] ?? null : null}
        offerLabel={detailService ? serviceOfferLabels.get(detailService.id) : undefined}
        onClose={() => setDetailService(null)}
        onToggle={handleToggleService}
        onQuantityChange={handleServiceQuantity}
        onPriceOptionChange={handleServicePriceOption}
      />

      <SalonPackageSheet
        pkg={detailPackage}
        fallbackImage={salonProfileImageUrl(salon)}
        selected={detailPackage ? cart.isPackageSelected(salon.id, detailPackage.id) : false}
        onClose={() => setDetailPackage(null)}
        onToggle={togglePackage}
      />

      <BottomSheet visible={reviewsOpen} title={`Reviews (${customerReviews.length})`} onClose={() => setReviewsOpen(false)}>
        <View style={styles.allReviews}>
          {customerReviews.map((review) => (
            <SalonReviewCard key={review.id} review={review} />
          ))}
        </View>
      </BottomSheet>

      <SalonGalleryLightbox
        visible={galleryOpen}
        gallery={fullGallery}
        salonName={salon.name}
        index={galleryIndex}
        onClose={() => setGalleryOpen(false)}
        onIndexChange={setGalleryIndex}
      />

      {hasCart ? (
        <SalonCartBar
          bottomInset={insets.bottom}
          totalLabel={formatRupees(total)}
          compareLabel={savings > 0 ? formatRupees(total + savings) : null}
          itemCount={itemCount}
          firstItemName={firstItemName}
          onContinue={() =>
            router.push({
              pathname: "/book/[salonId]",
              params: { salonId: currentSalon.id },
            })
          }
          onClear={() => cart.clearSalon(currentSalon.id)}
        />
      ) : null}
    </View>
  )
}

function CategoryHeader({ name, count }: { name: string; count: number }) {
  return (
    <View style={styles.categoryHeader} accessibilityRole="header">
      <Text style={styles.categoryName}>{name}</Text>
      <Text style={styles.categoryCount}>
        {count} {count === 1 ? "item" : "items"}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
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
  tabsInFlow: {
    marginTop: 24,
  },
  audienceRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: sp.gutter,
    paddingTop: 12,
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
    marginBottom: 4,
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
  packages: {
    gap: 12,
    paddingTop: 10,
    paddingBottom: 4,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: sp.tabBorder,
    borderStyle: "dashed",
  },
  allReviews: {
    gap: 12,
    paddingBottom: 12,
  },
})
