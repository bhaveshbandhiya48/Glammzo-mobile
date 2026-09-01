import { Image } from "expo-image"
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
} from "react-native"
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Button } from "@/components/ui/Button"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { CartStrip } from "@/components/ui/CartStrip"
import { Icon } from "@/components/ui/Icon"
import { SalonDetailSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { SalonGalleryLightbox } from "@/components/salon/SalonGalleryLightbox"
import { SalonOffersCarousel } from "@/components/salon/SalonOffersCarousel"
import { useCart } from "@/context/CartContext"
import { useFavorites } from "@/context/FavoritesContext"
import {
  flattenAmenities,
  getSalonHeroSlides,
} from "@/data/mocks/salons"
import type { Salon, SalonPackage, SalonReview, SalonService } from "@/data/types"
import { getSalonByIdLive } from "@/lib/salons-api"
import {
  fetchGlammzoOffersForSalon,
  type GlammzoOfferCard,
} from "@/lib/glammzo-offers-api"
import { withSalonDistanceFromLocation } from "@/lib/explore-location"
import { LEGAL } from "@/lib/legal"
import { bestOfferForService, formatOfferDiscountBadge } from "@/lib/offer-badges"
import { resolvePackageBadge } from "@/lib/package-badges"
import { getSavedLocation } from "@/lib/user"
import { salonWhatsAppUrl } from "@/lib/whatsapp"
import { colors, radii, spacing } from "@/theme/tokens"

const PACKAGES_CATEGORY = "Packages"

function HeroGradient() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="heroScrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity="0.55" />
          <Stop offset="0.4" stopColor="#000000" stopOpacity="0.12" />
          <Stop offset="0.65" stopColor="#000000" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroScrim)" />
    </Svg>
  )
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }, (_, index) => (
        <Icon
          key={index}
          name={index < Math.round(rating) ? "star" : "star-outline"}
          size={14}
          color={index < Math.round(rating) ? colors.coral : colors.textSubtle}
        />
      ))}
    </View>
  )
}

function ReviewCard({ review }: { review: SalonReview }) {
  const initials = review.authorName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAuthor}>
          <View style={styles.avatar}>
            <Text variant="caption" color={colors.coral}>
              {initials}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{review.authorName}</Text>
            <Text variant="caption" muted>
              {review.date}
            </Text>
          </View>
        </View>
        <StarRow rating={review.rating} />
      </View>
      <Text style={styles.reviewComment}>{review.comment}</Text>
      <Text variant="caption" muted>
        {review.serviceName}
        {review.staffMember.name ? ` · with ${review.staffMember.name}` : ""}
        {review.verified ? " · Verified visit" : ""}
      </Text>
      {review.ownerReply?.trim() ? (
        <View style={styles.ownerReply}>
          <Text variant="label" muted>
            Response from salon
          </Text>
          <Text style={{ marginTop: spacing.sm }}>{review.ownerReply}</Text>
          {review.ownerReplyDate ? (
            <Text variant="caption" muted style={{ marginTop: spacing.xs }}>
              {review.ownerReplyDate}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

export default function SalonDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [salon, setSalon] = useState<Salon | undefined>()
  const [loading, setLoading] = useState(true)
  const cart = useCart()
  const { isFavorite, toggle } = useFavorites()
  const [slideIndex, setSlideIndex] = useState(0)
  const [detailService, setDetailService] = useState<SalonService | null>(null)
  const [detailPackage, setDetailPackage] = useState<SalonPackage | null>(null)
  const [headerSolid, setHeaderSolid] = useState(false)
  const [activeServiceCategory, setActiveServiceCategory] = useState<string>("")
  const [expandedServiceCategories, setExpandedServiceCategories] = useState<string[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuExpandedCategory, setMenuExpandedCategory] = useState<string>("")
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [glammzoOffers, setGlammzoOffers] = useState<GlammzoOfferCard[]>([])
  const sliderRef = useRef<ScrollView>(null)
  const pageScrollRef = useRef<ScrollView>(null)
  const serviceCategoryOffsets = useRef<Record<string, number>>({})
  const serviceCategoryBaseOffset = useRef(0)
  const serviceListOffsets = useRef<Record<string, number>>({})
  const serviceItemOffsets = useRef<Record<string, number>>({})
  const packageSectionOffset = useRef(0)

  useEffect(() => {
    let active = true
    if (typeof id !== "string") {
      setSalon(undefined)
      setGlammzoOffers([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([getSalonByIdLive(id), getSavedLocation()]).then(
      ([next, location]) => {
        if (!active) return
        const withDistance = next
          ? withSalonDistanceFromLocation(next, location)
          : undefined
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
      },
    )
    return () => {
      active = false
    }
  }, [id])

  const selectedServices = useMemo(() => {
    if (!salon) return []
    const salonCart = cart.getCart(salon.id)
    if (!salonCart) return []
    return salon.services.filter((service) => salonCart.serviceIds.includes(service.id))
  }, [cart, salon])

  const selectedPackage = useMemo(() => {
    if (!salon) return undefined
    const salonCart = cart.getCart(salon.id)
    if (!salonCart?.packageId) return undefined
    return salon.packages.find((item) => item.id === salonCart.packageId)
  }, [cart, salon])

  const total = selectedPackage
    ? selectedPackage.packagePrice
    : selectedServices.reduce((sum, service) => sum + service.price, 0)

  const slides = useMemo(() => (salon ? getSalonHeroSlides(salon, 5) : []), [salon])
  const whatsappUrl = useMemo(
    () =>
      salon
        ? salonWhatsAppUrl(
            salon.whatsappPhone,
            `Hi ${salon.name}, I found you on Glammzo and would like to enquire.`,
          )
        : null,
    [salon],
  )
  const amenityRows = useMemo(() => flattenAmenities(salon?.amenities).slice(0, 10), [salon])
  const customerReviews = salon?.customerReviews ?? []
  const serviceGroups = useMemo(() => {
    if (!salon) return []
    const groups = new Map<string, SalonService[]>()
    for (const service of salon.services) {
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
  }, [salon])

  const catalogCategories = useMemo(() => {
    const categories = serviceGroups.map((group) => group.category)
    if ((salon?.packages.length ?? 0) > 0) return [PACKAGES_CATEGORY, ...categories]
    return categories
  }, [salon?.packages.length, serviceGroups])

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

  useEffect(() => {
    const first = catalogCategories[0] ?? ""
    setActiveServiceCategory(first)
    setExpandedServiceCategories(catalogCategories)
    setMenuExpandedCategory(first)
  }, [catalogCategories])

  function expandServiceCategory(category: string) {
    setExpandedServiceCategories((current) =>
      current.includes(category) ? current : [...current, category]
    )
  }

  function toggleServiceCategory(category: string) {
    setExpandedServiceCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    )
  }

  useEffect(() => {
    if (!menuOpen) return
    setMenuExpandedCategory(activeServiceCategory || serviceGroups[0]?.category || "")
  }, [menuOpen])

  function onHeroMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(windowWidth, 1))
    if (next !== slideIndex) setSlideIndex(next)
  }

  function onPageScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = event.nativeEvent.contentOffset.y
    const next = y > Math.max(48, insets.top)
    if (next !== headerSolid) setHeaderSolid(next)
  }

  if (loading) {
    return <SalonDetailSkeleton />
  }

  if (!salon) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text variant="heading">Salon not found</Text>
        <Button
          label="Back to Explore"
          style={{ marginTop: spacing.xl }}
          onPress={() => router.replace("/(tabs)/explore")}
        />
      </View>
    )
  }

  const offer = salon.offers.find((item) => item.isActive)
  const favorited = isFavorite(salon.id)
  const galleryPreview = slides
  const galleryTile = (windowWidth - spacing.xl * 2 - spacing.sm * 2) / 3
  const hasCart = cart.itemCountFor(salon.id) > 0
  const packagesExpanded = expandedServiceCategories.includes(PACKAGES_CATEGORY)
  const showMenuFab = salon.packages.length > 0 || serviceGroups.length > 1
  const cartImages = [
    ...selectedServices.map((service) => service.imageUrl),
    ...(selectedPackage ? [selectedPackage.imageUrl] : []),
  ]
  const cartPreviewLabel = [
    ...selectedServices.map((service) => service.name),
    ...(selectedPackage ? [selectedPackage.name] : []),
  ]
    .slice(0, 2)
    .join(", ")

  return (
    <View style={styles.root}>
      <StatusBar style={headerSolid ? "dark" : "light"} />

      <View
        style={[
          styles.stickyHeader,
          { paddingTop: insets.top + spacing.sm },
          headerSolid && styles.stickyHeaderSolid,
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => {
            if (router.canGoBack()) router.back()
            else router.replace("/(tabs)/explore")
          }}
          style={[styles.chromeBtn, headerSolid && styles.chromeBtnSolid]}
        >
          <Icon
            name="chevron-back"
            size={24}
            color={headerSolid ? colors.text : colors.primaryFg}
          />
        </Pressable>

        {headerSolid ? (
          <Text variant="bodyStrong" numberOfLines={1} style={styles.stickyTitle}>
            {salon.name}
          </Text>
        ) : (
          <View style={styles.stickySpacer} />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorited ? "Remove favorite" : "Save salon"}
          onPress={() => {
            void (async () => {
              const result = await toggle(salon.id)
              if (result === "auth") {
                router.push({
                  pathname: "/login",
                  params: { next: `/salon/${salon.id}` },
                })
              }
            })()
          }}
          style={[styles.chromeBtn, headerSolid && styles.chromeBtnSolid]}
        >
          <Icon
            name={favorited ? "heart" : "heart-outline"}
            size={20}
            color={
              favorited ? colors.coral : headerSolid ? colors.text : colors.primaryFg
            }
          />
        </Pressable>
      </View>

      <ScrollView
        ref={pageScrollRef}
        style={styles.root}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces
        onScroll={onPageScroll}
        scrollEventThrottle={16}
      >
        <View style={[styles.heroWrap, { width: windowWidth, height: windowWidth }]}>
          <ScrollView
            ref={sliderRef}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            directionalLockEnabled
            disableIntervalMomentum
            showsHorizontalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            onMomentumScrollEnd={onHeroMomentumEnd}
            style={{ width: windowWidth, height: windowWidth }}
            contentContainerStyle={{ height: windowWidth }}
          >
            {slides.map((uri, index) => (
              <View
                key={`${uri}-${index}`}
                style={{ width: windowWidth, height: windowWidth }}
              >
                <Image
                  source={{ uri }}
                  style={styles.heroImage}
                  contentFit="cover"
                  pointerEvents="none"
                />
              </View>
            ))}
          </ScrollView>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <HeroGradient />
          </View>
          {slides.length > 1 ? (
            <View style={styles.dots} pointerEvents="none">
              {slides.map((uri, index) => (
                <View
                  key={`${uri}-dot-${index}`}
                  style={[styles.dot, index === slideIndex && styles.dotActive]}
                />
              ))}
            </View>
          ) : null}
          <View style={styles.photoCount} pointerEvents="none">
            <Text variant="caption" color={colors.primaryFg}>
              {slideIndex + 1}/{slides.length}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.badges}>
            <Text variant="caption" color={salon.isOpenNow ? colors.success : colors.textSubtle}>
              {salon.isOpenNow ? "Open now" : "Closed"}
            </Text>
            {offer ? (
              <Text variant="caption" color={colors.coral}>
                {offer.title}
              </Text>
            ) : null}
          </View>
          <Text variant="title">{salon.name}</Text>
          <Text muted>
            {salon.area}, {salon.city}
          </Text>
          <Text variant="caption" style={styles.meta}>
            ★ {salon.rating.toFixed(1)} · {salon.reviews} reviews
            {salon.distanceKm > 0 ? ` · ${salon.distanceKm.toFixed(1)} km` : ""}
          </Text>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Call"
              style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
              onPress={() => Linking.openURL(`tel:${salon.phone.replace(/\s/g, "")}`)}
            >
              <Icon name="call-outline" size={20} color={colors.text} />
            </Pressable>
            {whatsappUrl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="WhatsApp"
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
                onPress={() => void Linking.openURL(whatsappUrl)}
              >
                <Icon name="logo-whatsapp" size={22} color="#25D366" />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Directions"
              style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
              onPress={() =>
                Linking.openURL(
                  `https://maps.google.com/?q=${encodeURIComponent(salon.address)}`,
                )
              }
            >
              <Icon name="navigate-outline" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share"
              style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
              onPress={() => {
                const url = `${LEGAL.siteUrl}/salons/${encodeURIComponent(salon.id)}`
                const message = [
                  `Check out ${salon.name} on Glammzo`,
                  salon.area ? `${salon.area}${salon.city ? `, ${salon.city}` : ""}` : null,
                  url,
                ]
                  .filter(Boolean)
                  .join("\n")

                void Share.share(
                  Platform.OS === "ios"
                    ? { message, url }
                    : { message, title: salon.name },
                ).catch(() => {
                  // User dismissed sheet or share unavailable — ignore.
                })
              }}
            >
              <Icon name="share-outline" size={20} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.copy}>{salon.description}</Text>

          {glammzoOffers.length > 0 || salon.offers.length > 0 ? (
            <>
              <Text variant="label" muted style={styles.section}>
                Offers for you
              </Text>
              <SalonOffersCarousel
                glammzoOffers={glammzoOffers}
                salonOffers={salon.offers}
                onPressCta={() => {
                  const y = serviceCategoryBaseOffset.current || packageSectionOffset.current
                  pageScrollRef.current?.scrollTo({
                    y: Math.max(0, y - 140),
                    animated: true,
                  })
                }}
              />
            </>
          ) : null}

          <Text variant="label" muted style={styles.section}>
            Services
          </Text>
          {catalogCategories.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.serviceCategoryChips}
            >
              {catalogCategories.map((category) => {
                const active = activeServiceCategory === category
                return (
                  <Pressable
                    key={category}
                    onPress={() => {
                      setActiveServiceCategory(category)
                      expandServiceCategory(category)
                      const y = serviceCategoryOffsets.current[category]
                      if (typeof y === "number") {
                        pageScrollRef.current?.scrollTo({
                          y: Math.max(0, y - 140),
                          animated: true,
                        })
                      }
                    }}
                    style={[
                      styles.serviceCategoryChip,
                      active && styles.serviceCategoryChipActive,
                    ]}
                  >
                    <Text
                      variant="caption"
                      color={active ? colors.coral : colors.text}
                    >
                      {category}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          ) : null}

          <View
            style={styles.serviceCategoryList}
            onLayout={(event) => {
              serviceCategoryBaseOffset.current = event.nativeEvent.layout.y
            }}
          >
            {salon.packages.length > 0 ? (
              <View
                onLayout={(event) => {
                  const y = serviceCategoryBaseOffset.current + event.nativeEvent.layout.y
                  serviceCategoryOffsets.current[PACKAGES_CATEGORY] = y
                  packageSectionOffset.current = y
                }}
                style={styles.serviceCategorySection}
              >
                <Pressable
                  onPress={() => {
                    setActiveServiceCategory(PACKAGES_CATEGORY)
                    toggleServiceCategory(PACKAGES_CATEGORY)
                  }}
                  style={styles.serviceCategoryHeader}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: packagesExpanded }}
                  accessibilityLabel={`Packages, ${salon.packages.length} ${salon.packages.length === 1 ? "item" : "items"}`}
                >
                  <View style={styles.serviceCategoryHeaderCopy}>
                    <Text variant="bodyStrong">{PACKAGES_CATEGORY}</Text>
                    <Text variant="caption" muted>
                      {salon.packages.length}{" "}
                      {salon.packages.length === 1 ? "item" : "items"}
                    </Text>
                  </View>
                  <Icon
                    name={packagesExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.textSubtle}
                  />
                </Pressable>

                {packagesExpanded ? (
                  <View
                    style={styles.serviceList}
                    onLayout={(event) => {
                      serviceListOffsets.current[PACKAGES_CATEGORY] =
                        event.nativeEvent.layout.y
                    }}
                  >
                    {salon.packages.map((pkg, index) => {
                      const selected = cart.isPackageSelected(salon.id, pkg.id)
                      const packageBadge = resolvePackageBadge(pkg.badge)
                      const includedCount = pkg.items.reduce(
                        (sum, item) => sum + item.quantity,
                        0,
                      )
                      return (
                        <View
                          key={pkg.id}
                          onLayout={(event) => {
                            serviceItemOffsets.current[pkg.id] =
                              serviceCategoryOffsets.current[PACKAGES_CATEGORY] +
                              (serviceListOffsets.current[PACKAGES_CATEGORY] ?? 0) +
                              event.nativeEvent.layout.y
                          }}
                          style={[
                            styles.serviceRow,
                            selected && styles.serviceRowSelected,
                            index === salon.packages.length - 1 && styles.serviceRowLast,
                          ]}
                        >
                          <Pressable
                            style={styles.serviceMain}
                            onPress={() => setDetailPackage(pkg)}
                            accessibilityRole="button"
                            accessibilityLabel={`${pkg.name} package details`}
                          >
                            <Image
                              source={{
                                uri: pkg.imageUrl || salon.imageUrl || salon.coverImageUrl,
                              }}
                              style={styles.serviceThumb}
                              contentFit="cover"
                            />
                            <View style={styles.serviceCopy}>
                              <View style={styles.serviceNameRow}>
                                <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                                  {pkg.name}
                                </Text>
                                {packageBadge ? (
                                  <View style={styles.serviceOfferBadge}>
                                    <Text
                                      variant="caption"
                                      color={colors.coral}
                                      style={styles.serviceOfferBadgeLabel}
                                    >
                                      {packageBadge.label}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text variant="caption" muted numberOfLines={1}>
                                {pkg.shortDescription ||
                                  `${includedCount || pkg.items.length || 1} ${(includedCount || pkg.items.length || 1) === 1 ? "service" : "services"}`}
                              </Text>
                              <View style={styles.serviceMeta}>
                                {pkg.totalDurationMin > 0 ? (
                                  <>
                                    <Icon name="time-outline" size={13} color={colors.textSubtle} />
                                    <Text variant="caption" muted>
                                      {pkg.totalDurationMin} min
                                    </Text>
                                    <Text variant="caption" muted>
                                      ·
                                    </Text>
                                  </>
                                ) : null}
                                <Text variant="caption" color={colors.text}>
                                  ₹{pkg.packagePrice}
                                </Text>
                                {pkg.showComparePrice !== false &&
                                pkg.comparePrice > pkg.packagePrice ? (
                                  <Text variant="caption" muted style={styles.strike}>
                                    ₹{pkg.comparePrice}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={selected ? "Remove from cart" : "Add to cart"}
                            onPress={() => {
                              cart.setPackage(salon.id, selected ? null : pkg.id)
                            }}
                            style={[styles.addBtn, selected && styles.addBtnSelected]}
                          >
                            <Text
                              variant="caption"
                              color={selected ? colors.text : colors.primaryFg}
                              style={styles.addBtnLabel}
                            >
                              {selected ? "Remove" : "Add"}
                            </Text>
                          </Pressable>
                        </View>
                      )
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            {serviceGroups.map((group) => {
              const expanded = expandedServiceCategories.includes(group.category)
              return (
              <View
                key={group.category}
                onLayout={(event) => {
                  serviceCategoryOffsets.current[group.category] =
                    serviceCategoryBaseOffset.current + event.nativeEvent.layout.y
                }}
                style={styles.serviceCategorySection}
              >
                <Pressable
                  onPress={() => {
                    setActiveServiceCategory(group.category)
                    toggleServiceCategory(group.category)
                  }}
                  style={styles.serviceCategoryHeader}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${group.category}, ${group.items.length} ${group.items.length === 1 ? "item" : "items"}`}
                >
                  <View style={styles.serviceCategoryHeaderCopy}>
                    <Text variant="bodyStrong">{group.category}</Text>
                    <Text variant="caption" muted>
                      {group.items.length} {group.items.length === 1 ? "item" : "items"}
                    </Text>
                  </View>
                  <Icon
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.textSubtle}
                  />
                </Pressable>

                {expanded ? (
                <View
                  style={styles.serviceList}
                  onLayout={(event) => {
                    serviceListOffsets.current[group.category] = event.nativeEvent.layout.y
                  }}
                >
                  {group.items.map((service, index) => {
                    const selected = cart.isServiceSelected(salon.id, service.id)
                    return (
                      <View
                        key={service.id}
                        onLayout={(event) => {
                          serviceItemOffsets.current[service.id] =
                            serviceCategoryOffsets.current[group.category] +
                            (serviceListOffsets.current[group.category] ?? 0) +
                            event.nativeEvent.layout.y
                        }}
                        style={[
                          styles.serviceRow,
                          selected && styles.serviceRowSelected,
                          index === group.items.length - 1 && styles.serviceRowLast,
                        ]}
                      >
                        <Pressable
                          style={styles.serviceMain}
                          onPress={() => setDetailService(service)}
                          accessibilityRole="button"
                          accessibilityLabel={`${service.name} details`}
                        >
                          <Image
                            source={{ uri: service.imageUrl }}
                            style={styles.serviceThumb}
                            contentFit="cover"
                          />
                          <View style={styles.serviceCopy}>
                            <View style={styles.serviceNameRow}>
                              <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                                {service.name}
                              </Text>
                              {serviceOfferLabels.get(service.id) ? (
                                <View style={styles.serviceOfferBadge}>
                                  <Text
                                    variant="caption"
                                    color={colors.coral}
                                    style={styles.serviceOfferBadgeLabel}
                                  >
                                    {serviceOfferLabels.get(service.id)}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            {service.description ? (
                              <Text variant="caption" muted numberOfLines={1}>
                                {service.description}
                              </Text>
                            ) : (
                              <Text variant="caption" muted numberOfLines={1}>
                                {service.category}
                              </Text>
                            )}
                            <View style={styles.serviceMeta}>
                              <Icon name="time-outline" size={13} color={colors.textSubtle} />
                              <Text variant="caption" muted>
                                {service.durationMin} min
                              </Text>
                              <Text variant="caption" muted>
                                ·
                              </Text>
                              <Text variant="caption" color={colors.text}>
                                ₹{service.price}
                              </Text>
                              {service.compareAtPrice ? (
                                <Text variant="caption" muted style={styles.strike}>
                                  ₹{service.compareAtPrice}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={selected ? "Remove from cart" : "Add to cart"}
                          onPress={() => cart.toggleService(salon.id, service.id)}
                          style={[styles.addBtn, selected && styles.addBtnSelected]}
                        >
                          <Text
                            variant="caption"
                            color={selected ? colors.text : colors.primaryFg}
                            style={styles.addBtnLabel}
                          >
                            {selected ? "Remove" : "Add"}
                          </Text>
                        </Pressable>
                      </View>
                    )
                  })}
                </View>
                ) : null}
              </View>
              )
            })}
          </View>

          {galleryPreview.length > 0 ? (
            <>
              <Text variant="label" muted style={styles.section}>
                Gallery
              </Text>
              <Text variant="heading" style={styles.sectionTitle}>
                Inside the salon
              </Text>
              <View style={styles.galleryGrid}>
                {galleryPreview.map((uri, index) => (
                  <Pressable
                    key={`${uri}-g-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${salon.name} gallery photo ${index + 1}`}
                    onPress={() => {
                      setGalleryIndex(index)
                      setGalleryOpen(true)
                    }}
                  >
                    <Image
                      source={{ uri }}
                      style={{ width: galleryTile, height: galleryTile, borderRadius: radii.md }}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text variant="label" muted style={styles.section}>
            Business details
          </Text>
          <View style={styles.panel}>
            <Text variant="bodyStrong">{salon.address}</Text>
            <Text muted>{salon.hours}</Text>
            <Text muted>{salon.phone}</Text>
          </View>

          {amenityRows.length > 0 ? (
            <>
              <Text variant="label" muted style={styles.section}>
                Amenities
              </Text>
              <Text variant="heading" style={styles.sectionTitle}>
                What this place offers
              </Text>
              <View style={styles.amenityList}>
                {amenityRows.map((row) => (
                  <View key={row.id} style={styles.amenityRow}>
                    <Icon name={row.icon} size={22} color={colors.text} />
                    <Text style={{ flex: 1 }}>{row.label}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {salon.team.length > 0 ? (
            <>
              <Text variant="label" muted style={styles.section}>
                Team
              </Text>
              <Text variant="heading" style={styles.sectionTitle}>
                Meet the specialists
              </Text>
              {salon.team.map((member) => (
                <View key={member.id} style={styles.teamCard}>
                  {member.imageUrl ? (
                    <Image
                      source={{ uri: member.imageUrl }}
                      style={styles.teamPhoto}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={styles.teamAvatar}>
                      <Text variant="bodyStrong" color={colors.primaryFg}>
                        {member.name.slice(0, 1)}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodyStrong">{member.name}</Text>
                    <Text variant="caption" muted>
                      {member.role}
                    </Text>
                    {member.bio ? (
                      <Text muted style={styles.teamBio}>
                        {member.bio}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </>
          ) : null}

          <Text variant="label" muted style={styles.section}>
            Reviews
          </Text>
          <View style={styles.reviewSummary}>
            <Text variant="title">{salon.rating.toFixed(1)}</Text>
            <View>
              <StarRow rating={salon.rating} />
              <Text variant="caption" muted style={{ marginTop: 4 }}>
                {salon.reviews} reviews
              </Text>
            </View>
          </View>
          {customerReviews.length > 0 ? (
            customerReviews.map((review) => <ReviewCard key={review.id} review={review} />)
          ) : (
            <View style={styles.emptyReviews}>
              <Text muted>No reviews yet. Be the first after your visit.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <BottomSheet
        visible={detailService != null}
        title="Service summary"
        onClose={() => setDetailService(null)}
      >
        {detailService ? (
          <View style={styles.sheetBody}>
            <Image
              source={{ uri: detailService.imageUrl }}
              style={styles.sheetImage}
              contentFit="cover"
            />
            <View style={styles.serviceNameRow}>
              <Text variant="heading" style={{ flexShrink: 1 }}>
                {detailService.name}
              </Text>
              {serviceOfferLabels.get(detailService.id) ? (
                <View style={styles.serviceOfferBadge}>
                  <Text
                    variant="caption"
                    color={colors.coral}
                    style={styles.serviceOfferBadgeLabel}
                  >
                    {serviceOfferLabels.get(detailService.id)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text muted style={{ marginTop: spacing.xs }}>
              {detailService.category} · {detailService.durationMin} min
            </Text>
            <View style={styles.sheetPriceBox}>
              <Text variant="caption" muted>
                Price
              </Text>
              <View style={styles.sheetPriceRow}>
                <Text variant="title">₹{detailService.price}</Text>
                {detailService.compareAtPrice ? (
                  <Text muted style={styles.strike}>
                    ₹{detailService.compareAtPrice}
                  </Text>
                ) : null}
              </View>
            </View>
            {detailService.includes.length > 0 ? (
              <>
                <Text variant="label" muted style={{ marginTop: spacing.xl }}>
                  Includes
                </Text>
                {detailService.includes.map((item) => (
                  <View key={item} style={styles.includeRow}>
                    <Icon name="checkmark-circle" size={18} color={colors.coral} />
                    <Text style={{ flex: 1 }}>{item}</Text>
                  </View>
                ))}
              </>
            ) : null}
            <Button
              label={
                cart.isServiceSelected(salon.id, detailService.id)
                  ? "Remove from cart"
                  : "Add to cart"
              }
              variant={
                cart.isServiceSelected(salon.id, detailService.id)
                  ? "secondary"
                  : "primary"
              }
              style={{ marginTop: spacing.xxl }}
              onPress={() => {
                cart.toggleService(salon.id, detailService.id)
                setDetailService(null)
              }}
            />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={detailPackage != null}
        title="Package summary"
        onClose={() => setDetailPackage(null)}
      >
        {detailPackage ? (
          <View style={styles.sheetBody}>
            <Image
              source={{
                uri:
                  detailPackage.imageUrl ||
                  salon.imageUrl ||
                  salon.coverImageUrl,
              }}
              style={styles.sheetImage}
              contentFit="cover"
            />
            <Text variant="heading">{detailPackage.name}</Text>
            <Text muted style={{ marginTop: spacing.xs }}>
              Package
              {detailPackage.totalDurationMin > 0
                ? ` · ${detailPackage.totalDurationMin} min`
                : ""}
              {detailPackage.items.length > 0
                ? ` · ${detailPackage.items.length} services`
                : ""}
            </Text>
            {detailPackage.shortDescription ? (
              <Text muted style={{ marginTop: spacing.md }}>
                {detailPackage.shortDescription}
              </Text>
            ) : null}
            <View style={styles.sheetPriceBox}>
              <Text variant="caption" muted>
                Price
              </Text>
              <View style={styles.sheetPriceRow}>
                <Text variant="title">₹{detailPackage.packagePrice}</Text>
                {detailPackage.showComparePrice !== false &&
                detailPackage.comparePrice > detailPackage.packagePrice ? (
                  <Text muted style={styles.strike}>
                    ₹{detailPackage.comparePrice}
                  </Text>
                ) : null}
              </View>
            </View>
            {detailPackage.items.length > 0 ? (
              <>
                <Text variant="label" muted style={{ marginTop: spacing.xl }}>
                  Includes
                </Text>
                {detailPackage.items.map((item) => (
                  <View
                    key={`${detailPackage.id}-${item.serviceId}`}
                    style={styles.includeRow}
                  >
                    <Icon name="checkmark-circle" size={18} color={colors.coral} />
                    <Text style={{ flex: 1 }}>
                      {item.quantity > 1 ? `${item.quantity}× ` : ""}
                      {item.serviceName}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}
            <Button
              label={
                cart.isPackageSelected(salon.id, detailPackage.id)
                  ? "Remove from cart"
                  : "Add to cart"
              }
              variant={
                cart.isPackageSelected(salon.id, detailPackage.id)
                  ? "secondary"
                  : "primary"
              }
              style={{ marginTop: spacing.xxl }}
              onPress={() => {
                const selected = cart.isPackageSelected(salon.id, detailPackage.id)
                cart.setPackage(salon.id, selected ? null : detailPackage.id)
                setDetailPackage(null)
              }}
            />
          </View>
        ) : null}
      </BottomSheet>

      <SalonGalleryLightbox
        visible={galleryOpen}
        gallery={galleryPreview}
        salonName={salon.name}
        index={galleryIndex}
        onClose={() => setGalleryOpen(false)}
        onIndexChange={setGalleryIndex}
      />

      {showMenuFab ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu categories"
          onPress={() => setMenuOpen(true)}
          style={[
            styles.menuFab,
            hasCart && styles.menuFabWithCart,
          ]}
        >
          <Icon name="grid-outline" size={18} color={colors.primaryFg} />
          <Text variant="bodyStrong" color={colors.primaryFg}>
            Menu
          </Text>
        </Pressable>
      ) : null}

      <BottomSheet
        visible={menuOpen}
        title="Browse menu"
        onClose={() => setMenuOpen(false)}
        compact
      >
        <View style={styles.menuSheetList}>
          {salon.packages.length > 0 ? (
            <View
              style={[
                styles.menuSection,
                menuExpandedCategory === PACKAGES_CATEGORY && styles.menuSectionActive,
              ]}
            >
              <Pressable
                onPress={() => {
                  setMenuExpandedCategory(
                    menuExpandedCategory === PACKAGES_CATEGORY ? "" : PACKAGES_CATEGORY,
                  )
                }}
                style={styles.menuSheetHeader}
              >
                <View style={styles.menuSheetCopy}>
                  <Text variant="bodyStrong">{PACKAGES_CATEGORY}</Text>
                  <Text variant="caption" muted>
                    {salon.packages.length}{" "}
                    {salon.packages.length === 1 ? "item" : "items"}
                  </Text>
                </View>
                <Icon
                  name={menuExpandedCategory === PACKAGES_CATEGORY ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={
                    menuExpandedCategory === PACKAGES_CATEGORY ? colors.coral : colors.textSubtle
                  }
                />
              </Pressable>

              {menuExpandedCategory === PACKAGES_CATEGORY
                ? salon.packages.map((pkg, index) => (
                    <Pressable
                      key={pkg.id}
                      onPress={() => {
                        setMenuOpen(false)
                        setActiveServiceCategory(PACKAGES_CATEGORY)
                        expandServiceCategory(PACKAGES_CATEGORY)
                        const y = serviceItemOffsets.current[pkg.id]
                        if (typeof y === "number") {
                          pageScrollRef.current?.scrollTo({
                            y: Math.max(0, y - 140),
                            animated: true,
                          })
                        }
                      }}
                      style={[
                        styles.menuServiceRow,
                        index === salon.packages.length - 1 && styles.menuServiceRowLast,
                      ]}
                    >
                      <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                        {pkg.name}
                      </Text>
                      <Text variant="caption" muted>
                        ₹{pkg.packagePrice}
                      </Text>
                    </Pressable>
                  ))
                : null}
            </View>
          ) : null}

          {serviceGroups.map((group) => {
            const expanded = menuExpandedCategory === group.category
            return (
              <View
                key={group.category}
                style={[styles.menuSection, expanded && styles.menuSectionActive]}
              >
                <Pressable
                  onPress={() => {
                    setMenuExpandedCategory(expanded ? "" : group.category)
                  }}
                  style={styles.menuSheetHeader}
                >
                  <View style={styles.menuSheetCopy}>
                    <Text variant="bodyStrong">{group.category}</Text>
                    <Text variant="caption" muted>
                      {group.items.length} {group.items.length === 1 ? "item" : "items"}
                    </Text>
                  </View>
                  <Icon
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={expanded ? colors.coral : colors.textSubtle}
                  />
                </Pressable>

                {expanded
                  ? group.items.map((service, index) => (
                      <Pressable
                        key={service.id}
                        onPress={() => {
                      setMenuOpen(false)
                      setActiveServiceCategory(group.category)
                      expandServiceCategory(group.category)
                      const y = serviceItemOffsets.current[service.id]
                          if (typeof y === "number") {
                            pageScrollRef.current?.scrollTo({
                              y: Math.max(0, y - 140),
                              animated: true,
                            })
                          }
                        }}
                        style={[
                          styles.menuServiceRow,
                          index === group.items.length - 1 && styles.menuServiceRowLast,
                        ]}
                      >
                        <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                          {service.name}
                        </Text>
                        {serviceOfferLabels.get(service.id) ? (
                          <View style={styles.serviceOfferBadge}>
                            <Text
                              variant="caption"
                              color={colors.coral}
                              style={styles.serviceOfferBadgeLabel}
                            >
                              {serviceOfferLabels.get(service.id)}
                            </Text>
                          </View>
                        ) : null}
                        <Text variant="caption" muted>
                          ₹{service.price}
                        </Text>
                      </Pressable>
                    ))
                  : null}
              </View>
            )
          })}
        </View>
      </BottomSheet>

      {hasCart ? (
        <CartStrip
          entries={[
            {
              salonId: salon.id,
              salonName: salon.name,
              itemCount: cart.itemCountFor(salon.id),
              totalLabel: `₹${total}`,
              imageUrls: cartImages,
              previewLabel: cartPreviewLabel,
              ctaLabel: "Checkout",
              onPress: () =>
                router.push({
                  pathname: "/book/[salonId]",
                  params: { salonId: salon.id },
                }),
              onClear: () => cart.clearSalon(salon.id),
            },
          ]}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  scroll: {
    paddingBottom: 120,
  },
  heroWrap: {
    position: "relative",
    backgroundColor: colors.muted,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  stickyHeaderSolid: {
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stickyTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Sora_600SemiBold",
    fontSize: 16,
  },
  menuFab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.xl,
    zIndex: 20,
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  menuFabWithCart: {
    bottom: 92,
  },
  stickySpacer: {
    flex: 1,
  },
  chromeBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  chromeBtnSolid: {
    backgroundColor: colors.muted,
  },
  dots: {
    position: "absolute",
    bottom: spacing.lg,
    alignSelf: "center",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  dotActive: {
    backgroundColor: colors.primaryFg,
    width: 16,
  },
  photoCount: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  badges: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  meta: {
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPressed: {
    opacity: 0.85,
  },
  copy: {
    marginTop: spacing.xl,
  },
  section: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    marginBottom: spacing.lg,
  },
  rowCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rowSelected: {
    borderColor: colors.coral,
    backgroundColor: "#FFF7F5",
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  strike: {
    textDecorationLine: "line-through",
  },
  serviceCategoryChips: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  serviceCategoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  serviceCategoryChipActive: {
    borderColor: colors.coral,
    backgroundColor: "#FFF7F5",
  },
  serviceCategoryList: {
    gap: spacing.xl,
  },
  serviceCategorySection: {
    gap: spacing.sm,
  },
  serviceCategoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  serviceCategoryHeaderCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  menuSheetList: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  menuSection: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  menuSectionActive: {
    borderColor: colors.coral,
    backgroundColor: "#FFF7F5",
  },
  menuSheetHeader: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  menuSheetCopy: {
    flex: 1,
    gap: 2,
  },
  menuServiceRow: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  menuServiceRowLast: {
    paddingBottom: spacing.xs,
  },
  serviceList: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  serviceRowSelected: {
    backgroundColor: "#FFF7F5",
  },
  serviceRowLast: {
    borderBottomWidth: 0,
  },
  serviceMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minWidth: 0,
  },
  serviceThumb: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  serviceCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  serviceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  serviceOfferBadge: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: "#FFF7F5",
  },
  serviceOfferBadgeLabel: {
    fontSize: 10,
    lineHeight: 14,
  },
  serviceMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  addBtn: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnSelected: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  addBtnLabel: {
    fontSize: 13,
  },
  sheetBody: {
    gap: spacing.xs,
  },
  sheetImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
    marginBottom: spacing.lg,
  },
  sheetPriceBox: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sheetPriceRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  includeRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  panel: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  amenityList: {
    gap: spacing.lg,
  },
  amenityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  teamCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  teamAvatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  teamPhoto: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
  },
  teamBio: {
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  reviewSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  reviewCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  reviewAuthor: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: "#FFF0ED",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewComment: {
    marginTop: spacing.xs,
  },
  ownerReply: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  starRow: {
    flexDirection: "row",
    gap: 2,
  },
  emptyReviews: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
})
