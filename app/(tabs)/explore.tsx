import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router"
import * as Location from "expo-location"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { BusinessTypeStrip } from "@/components/explore/BusinessTypeStrip"
import { LocationEmptyState } from "@/components/explore/LocationEmptyState"
import { LocationPickerSheet } from "@/components/explore/LocationPickerSheet"
import { MapOverlay } from "@/components/explore/MapOverlay"
import { PromoBannerCarousel, type PromoBannerItem } from "@/components/explore/PromoBannerCarousel"
import { FeaturedSalonCarousel } from "@/components/explore/FeaturedSalonCarousel"
import { SearchSuggestionsPanel } from "@/components/explore/SearchSuggestionsPanel"
import { TopChrome } from "@/components/layout/TopChrome"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { CartItemsSheet } from "@/components/ui/CartItemsSheet"
import { CartStrip } from "@/components/ui/CartStrip"
import { Icon } from "@/components/ui/Icon"
import { SalonCard } from "@/components/ui/SalonCard"
import { ExploreSalonsSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { useCart } from "@/context/CartContext"
import { useNetwork } from "@/context/NetworkContext"
import {
  BUSINESS_TYPE_ITEMS,
  countSalonsByBusinessType,
  isBusinessType,
} from "@/data/business-types"
import type { Salon } from "@/data/types"
import { ApiError } from "@/lib/api"
import {
  countActiveExploreFilters,
  DEFAULT_EXPLORE_FILTERS,
  EXPLORE_CATEGORY_FILTERS,
  EXPLORE_PRICE_FILTERS,
  EXPLORE_RADIUS_FILTERS,
  EXPLORE_RATING_FILTERS,
  EXPLORE_SORT_FILTERS,
  filterExploreSalons,
  sortExploreSalons,
  type ExploreFilterState,
} from "@/lib/explore-filters"
import {
  resolveExploreLocationSalons,
  salonsInSelectedLocation,
  withSalonDistanceFromLocation,
  partitionSalonsByCurrentArea,
  currentAreaLabel,
  NEARBY_RADIUS_KM,
  type LocationBrowseMode,
} from "@/lib/explore-location"
import {
  pickFeaturedSectionSalons,
  pickNearbyAfterFeatured,
} from "@/lib/featured-nearby"
import {
  createPlacesSessionToken,
  fetchNearbyAreas,
  fetchPlaceAutocomplete,
  fetchPlaceDetails,
  reverseGeocode,
  type PlacePrediction,
} from "@/lib/location-api"
import { fetchSalons, getCatalogSnapshot, hydrateCatalogFromStorage, resolveSalonById } from "@/lib/salons-api"
import {
  getPopularSearches,
  getSearchSuggestions,
} from "@/lib/search-suggestions"
import {
  DEFAULT_SAVED_LOCATION,
  getDisplayName,
  getSavedLocation,
  setSavedLocation,
  type SavedLocation,
} from "@/lib/user"
import {
  bootstrapLaunchPermissions,
  markSessionLocationManual,
  subscribeLaunchLocation,
} from "@/lib/launch-permissions"
import { fetchGlammzoOfferBanners } from "@/lib/glammzo-offers-api"
import { colors, radii, spacing } from "@/theme/tokens"

type FilterSectionId =
  | "category"
  | "price"
  | "rating"
  | "radius"
  | "availability"

const FILTER_SECTIONS: Array<{ id: FilterSectionId; label: string }> = [
  { id: "category", label: "Business type" },
  { id: "price", label: "Price" },
  { id: "rating", label: "Rating" },
  { id: "radius", label: "Distance" },
  { id: "availability", label: "Availability" },
]

export default function ExploreScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { category: categoryParam } = useLocalSearchParams<{ category?: string }>()
  const cart = useCart()
  const { isOffline } = useNetwork()
  const [username, setUsername] = useState("Guest")
  const [savedLocation, setSavedLocationState] = useState<SavedLocation | null>(null)
  const [locationMode, setLocationMode] = useState<LocationBrowseMode>("nearby")
  const [locationDraft, setLocationDraft] = useState("")
  const [locationOpen, setLocationOpen] = useState(false)
  const [placePredictions, setPlacePredictions] = useState<PlacePrediction[]>([])
  const [nearbyAreas, setNearbyAreas] = useState<PlacePrediction[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [placesLoading, setPlacesLoading] = useState(false)
  const [placesError, setPlacesError] = useState<string | null>(null)
  const [nearMeLoading, setNearMeLoading] = useState(false)
  const placesSession = useRef(createPlacesSessionToken())
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [suggestionQuery, setSuggestionQuery] = useState("")
  const [filters, setFilters] = useState<ExploreFilterState>(DEFAULT_EXPLORE_FILTERS)
  const [draftFilters, setDraftFilters] =
    useState<ExploreFilterState>(DEFAULT_EXPLORE_FILTERS)
  const [filterSection, setFilterSection] = useState<FilterSectionId>("category")
  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [activeCartSalonId, setActiveCartSalonId] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<Salon[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [offerBanners, setOfferBanners] = useState<PromoBannerItem[]>([])
  const catalogRequest = useRef(0)
  const wasOffline = useRef(false)

  const locationReady = savedLocation != null
  const location = savedLocation?.label ?? "Locating…"

  const tabBarStyle = useMemo(() => {
    const bottomPad = Math.max(insets.bottom, 8)
    return {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(228, 222, 210, 0.9)",
      height: 58 + bottomPad,
      paddingTop: 10,
      paddingBottom: bottomPad,
      ...(Platform.OS === "ios"
        ? {
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -4 },
          }
        : { elevation: 6 }),
    }
  }, [insets.bottom])

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: mapOpen ? { display: "none" as const } : tabBarStyle,
    })
  }, [mapOpen, navigation, tabBarStyle])

  // Legacy ?category= links open the dedicated category page (don't filter Explore).
  useEffect(() => {
    if (typeof categoryParam !== "string") return
    if (isBusinessType(categoryParam)) {
      router.replace({
        pathname: "/category/[type]",
        params: { type: categoryParam },
      })
      return
    }
    if (categoryParam === "all") {
      router.setParams({ category: undefined })
    }
  }, [categoryParam, router])

  useEffect(() => {
    return subscribeLaunchLocation((next) => {
      setSavedLocationState(next)
    })
  }, [])

  const loadCatalog = useCallback(async (force = false) => {
    const requestId = ++catalogRequest.current
    await hydrateCatalogFromStorage()
    if (requestId !== catalogRequest.current) return

    const cached = getCatalogSnapshot()
    if (cached.length > 0) {
      setCatalog(cached)
      setCatalogLoading(false)
    } else {
      setCatalogLoading(true)
    }

    try {
      const { salons: next } = await fetchSalons({ force })
      if (requestId !== catalogRequest.current) return
      setCatalog(next)
      setCatalogError(null)
    } catch (error) {
      if (requestId !== catalogRequest.current) return
      console.warn("[Glammzo] explore catalog load failed", error)
      const fallback = getCatalogSnapshot()
      if (fallback.length > 0) {
        setCatalog(fallback)
        setCatalogError(null)
        return
      }
      setCatalogError(
        error instanceof ApiError && error.status === 408
          ? "Connection timed out. Try again."
          : "Couldn't load salons. Check your connection and try again.",
      )
    } finally {
      if (requestId === catalogRequest.current) setCatalogLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      let cancelled = false

      void (async () => {
        // First visit: GPS bootstrap. Later visits: keep saved/manual pick for this session.
        await bootstrapLaunchPermissions()
        if (cancelled) return
        const saved = (await getSavedLocation()) ?? DEFAULT_SAVED_LOCATION
        if (!cancelled) setSavedLocationState(saved)

        const name = await getDisplayName()
        if (!cancelled) setUsername(name)
      })()

      void loadCatalog()

      return () => {
        cancelled = true
      }
    }, [loadCatalog]),
  )

  useEffect(() => {
    if (wasOffline.current && !isOffline) {
      void loadCatalog(true)
    }
    wasOffline.current = isOffline
  }, [isOffline, loadCatalog])

  useEffect(() => {
    let active = true
    void fetchGlammzoOfferBanners({
      city: savedLocation?.city,
      area: savedLocation?.area,
    }).then((offers) => {
      if (!active) return
      const next: PromoBannerItem[] = offers.map((offer) => ({
        id: offer.id,
        eyebrow: offer.eyebrow || "Glammzo offer",
        title: offer.title,
        subtitle:
          offer.subtitle ||
          (offer.promoCode ? `Use code ${offer.promoCode}` : offer.description),
        tone: "coral",
        imageUrl: offer.mobileBannerUrl,
        promoCode: offer.promoCode,
        ctaLabel: offer.ctaLabel || "Book now",
      }))
      setOfferBanners(next)
    })
    return () => {
      active = false
    }
  }, [savedLocation?.city, savedLocation?.area])

  const locationResult = useMemo(
    () => {
      if (!savedLocation) {
        return {
          salons: [] as Salon[],
          emptyKind: "none" as const,
          cityLabel: null,
          nearbyCount: 0,
          cityCount: 0,
          scopeLabel: null,
        }
      }
      return resolveExploreLocationSalons({
        catalog,
        location: savedLocation,
        mode: locationMode,
      })
    },
    [catalog, savedLocation, locationMode],
  )

  const scopedFiltered = useMemo(() => {
    return filterExploreSalons(locationResult.salons, filters, {
      query: searchQuery,
    })
  }, [filters, locationResult.salons, searchQuery])

  const salons = useMemo(
    () => sortExploreSalons(scopedFiltered, filters.sort),
    [filters.sort, scopedFiltered],
  )

  /** Map pins: all filtered salons with coordinates. Bottom cards use list `salons` (current area). */
  const mapSalons = useMemo(() => {
    const withDistance = catalog.map((salon) =>
      withSalonDistanceFromLocation(salon, savedLocation),
    )
    const filtered = filterExploreSalons(withDistance, filters, {
      query: searchQuery,
    })
    return sortExploreSalons(filtered, filters.sort)
  }, [catalog, filters, savedLocation, searchQuery])

  const activeFilterCount = countActiveExploreFilters(filters)
  const draftFilterCount = countActiveExploreFilters(draftFilters)

  const showHomeSections =
    locationReady &&
    !searchQuery.trim() &&
    filters.category === "all" &&
    activeFilterCount === 0 &&
    locationResult.emptyKind === "none"

  const featuredSection = useMemo(() => {
    if (!showHomeSections) {
      return { salons: [] as Salon[], usedNearbyFallback: false }
    }
    // Prefer distance order for Featured / Nearby continuity.
    return pickFeaturedSectionSalons(scopedFiltered)
  }, [scopedFiltered, showHomeSections])

  const nearbyGridSalons = useMemo(() => {
    if (!showHomeSections || featuredSection.salons.length === 0) {
      return salons
    }
    const remaining = pickNearbyAfterFeatured(
      scopedFiltered,
      featuredSection.salons,
    )
    return sortExploreSalons(remaining, filters.sort)
  }, [
    featuredSection.salons,
    filters.sort,
    salons,
    scopedFiltered,
    showHomeSections,
  ])

  const sortLabel =
    EXPLORE_SORT_FILTERS.find((item) => item.id === filters.sort)?.label ??
    "Recommended"

  const availableBusinessTypes = useMemo(() => {
    const scoped = salonsInSelectedLocation(catalog, savedLocation, locationMode)
    const counts = countSalonsByBusinessType(scoped)
    return BUSINESS_TYPE_ITEMS.map((item) => item.label).filter(
      (label) => (counts.get(label) ?? 0) > 0,
    )
  }, [catalog, savedLocation, locationMode])

  const showLocationEmpty =
    locationReady &&
    locationResult.emptyKind !== "none" &&
    !searchQuery.trim() &&
    filters.category === "all" &&
    activeFilterCount === 0

  const showFilterEmpty =
    locationReady &&
    !showLocationEmpty &&
    !catalogLoading &&
    salons.length === 0 &&
    (Boolean(searchQuery.trim()) || activeFilterCount > 0)

  const sectionTitle = searchQuery.trim()
    ? `Results for “${searchQuery.trim()}”`
    : filters.category !== "all"
      ? filters.category
      : showHomeSections && featuredSection.salons.length > 0
        ? locationMode === "city" && locationResult.cityLabel
          ? `Near ${locationResult.cityLabel}`
          : "Near you"
        : locationMode === "city" && locationResult.cityLabel
          ? `In ${locationResult.cityLabel}`
          : locationResult.nearbyCount > 0
            ? "Near you"
            : "Recommended for you"

  const gridSalons = showHomeSections ? nearbyGridSalons : salons
  const areaName = currentAreaLabel(savedLocation)
  const { local: localGridSalons, nearbyAreas: nearbyAreaGridSalons } = useMemo(() => {
    if (!showHomeSections) {
      return { local: gridSalons, nearbyAreas: [] as Salon[] }
    }
    return partitionSalonsByCurrentArea(gridSalons, savedLocation)
  }, [gridSalons, savedLocation, showHomeSections])

  const cartEntries = useMemo(() => {
    return cart.carts.flatMap((salonCart) => {
      const salon = resolveSalonById(salonCart.salonId)
      if (!salon) return []
      const services = salon.services.filter((service) =>
        salonCart.serviceIds.includes(service.id),
      )
      const selectedPackage = salonCart.packageId
        ? salon.packages.find((item) => item.id === salonCart.packageId)
        : undefined
      const total = selectedPackage
        ? selectedPackage.packagePrice
        : services.reduce((sum, service) => sum + service.price, 0)
      const images = [
        ...services.map((service) => service.imageUrl),
        ...(selectedPackage ? [selectedPackage.imageUrl] : []),
      ]
      const preview = [
        ...services.map((service) => service.name),
        ...(selectedPackage ? [selectedPackage.name] : []),
      ]
        .slice(0, 2)
        .join(", ")
      const itemCount =
        services.length + (selectedPackage ? 1 : 0)
      return [
        {
          salonId: salon.id,
          salonName: salon.name,
          itemCount,
          totalLabel: `₹${total}`,
          imageUrls: images,
          previewLabel: preview,
          onPress: () => {
            setActiveCartSalonId(salon.id)
            setCartOpen(true)
          },
          onClear: () => cart.clearSalon(salon.id),
        },
      ]
    })
  }, [cart, catalog])
  const showCart = cartEntries.length > 0

  const suggestions = useMemo(
    () => getSearchSuggestions(catalog, suggestionQuery),
    [catalog, suggestionQuery],
  )

  const popularSearches = useMemo(() => {
    const scoped = locationResult.salons.length > 0 ? locationResult.salons : catalog
    return getPopularSearches(scoped, 8)
  }, [catalog, locationResult.salons])
  useEffect(() => {
    if (!locationOpen) return
    const q = locationDraft.trim()
    if (q.length < 1) {
      setPlacePredictions([])
      setPlacesError(null)
      setPlacesLoading(false)
      return
    }

    let cancelled = false
    setPlacesLoading(true)
    const timer = setTimeout(() => {
      fetchPlaceAutocomplete({
        query: q,
        sessionToken: placesSession.current,
        latitude: savedLocation?.latitude,
        longitude: savedLocation?.longitude,
      })
        .then((predictions) => {
          if (cancelled) return
          setPlacePredictions(predictions)
          setPlacesError(null)
        })
        .catch((err) => {
          if (cancelled) return
          setPlacePredictions([])
          setPlacesError(
            err instanceof ApiError
              ? err.message
              : "Could not load place suggestions.",
          )
        })
        .finally(() => {
          if (!cancelled) setPlacesLoading(false)
        })
    }, 280)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [locationDraft, locationOpen, savedLocation?.latitude, savedLocation?.longitude])

  useEffect(() => {
    if (!locationOpen) {
      setNearbyAreas([])
      setNearbyLoading(false)
      return
    }

    let cancelled = false

    async function loadNearbyAreas() {
      setNearbyLoading(true)
      try {
        let lat = savedLocation?.latitude
        let lng = savedLocation?.longitude

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          const permission = await Location.getForegroundPermissionsAsync()
          if (!permission.granted) {
            if (!cancelled) setNearbyAreas([])
            return
          }
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          })
          lat = position.coords.latitude
          lng = position.coords.longitude
        }

        const areas = await fetchNearbyAreas({
          latitude: lat as number,
          longitude: lng as number,
        })
        if (!cancelled) setNearbyAreas(areas.slice(0, 3))
      } catch {
        if (!cancelled) setNearbyAreas([])
      } finally {
        if (!cancelled) setNearbyLoading(false)
      }
    }

    void loadNearbyAreas()
    return () => {
      cancelled = true
    }
  }, [locationOpen, savedLocation?.latitude, savedLocation?.longitude])

  function dismissSearch() {
    setSearchOpen(false)
    Keyboard.dismiss()
  }

  function openSearch() {
    setSuggestionQuery(searchQuery)
    setSearchOpen(true)
  }

  function commitSearch(value: string) {
    setSearchQuery(value.trim())
    dismissSearch()
  }

  async function commitLocation(next: SavedLocation) {
    const label = next.label.trim()
    if (!label) return
    markSessionLocationManual()
    await setSavedLocation(next)
    setSavedLocationState(next)
    setLocationMode("nearby")
    setPlacePredictions([])
    setPlacesError(null)
    setLocationOpen(false)
    placesSession.current = createPlacesSessionToken()
  }

  async function browseCity() {
    const city = locationResult.cityLabel?.trim()
    if (!city) return
    const next: SavedLocation = {
      ...(savedLocation ?? { label: city }),
      label: city,
      city,
      area: undefined,
    }
    markSessionLocationManual()
    await setSavedLocation(next)
    setSavedLocationState(next)
    setLocationMode("city")
  }

  function openLocationSheet() {
    setLocationDraft("")
    setPlacePredictions([])
    setPlacesError(null)
    placesSession.current = createPlacesSessionToken()
    setLocationOpen(true)
  }

  function closeLocationSheet() {
    setLocationOpen(false)
    setPlacesError(null)
    setPlacePredictions([])
    Keyboard.dismiss()
  }

  async function pickPrediction(prediction: PlacePrediction) {
    setPlacesLoading(true)
    setPlacesError(null)
    try {
      const place = await fetchPlaceDetails({
        placeId: prediction.placeId,
        sessionToken: placesSession.current,
      })
      await commitLocation({
        label: place.label,
        placeId: place.placeId,
        latitude: place.latitude,
        longitude: place.longitude,
        city: place.city,
        area: place.area,
        state: place.state,
        formattedAddress: place.formattedAddress,
      })
    } catch (err) {
      setPlacesError(
        err instanceof ApiError ? err.message : "Could not resolve that place.",
      )
    } finally {
      setPlacesLoading(false)
    }
  }

  async function handleUseCurrentLocation() {
    setNearMeLoading(true)
    setPlacesError(null)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        setPlacesError("Location permission is required for Near me.")
        return
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      const place = await reverseGeocode({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      })
      await commitLocation({
        label: place.label,
        placeId: place.placeId || undefined,
        latitude: place.latitude,
        longitude: place.longitude,
        city: place.city,
        area: place.area,
        state: place.state,
        formattedAddress: place.formattedAddress,
      })
    } catch (err) {
      setPlacesError(
        err instanceof ApiError
          ? err.message
          : "Could not detect your current location.",
      )
    } finally {
      setNearMeLoading(false)
    }
  }

  return (
    <View style={styles.root}>
      <TopChrome
        username={username}
        locationLabel={location}
        searchQuery={searchQuery}
        onSearchPress={openSearch}
        onClearSearch={() => setSearchQuery("")}
        onLocationChangePress={openLocationSheet}
        onNotificationsPress={() => router.push("/notifications")}
        onCartPress={() => {
          const first = cart.carts[0]
          if (first) {
            setActiveCartSalonId(first.salonId)
            setCartOpen(true)
          }
        }}
      />

      <SearchSuggestionsPanel
        visible={searchOpen}
        initialQuery={searchQuery}
        suggestions={suggestions}
        popularSearches={popularSearches}
        onQueryChange={setSuggestionQuery}
        onClose={dismissSearch}
        onPickQuery={commitSearch}
        onPickSalon={(id) => {
          dismissSearch()
          router.push({ pathname: "/salon/[id]", params: { id } })
        }}
      />

      <View style={styles.content}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, showCart && styles.scrollWithCart]}
        >
          <PromoBannerCarousel
            items={offerBanners}
            onPressItem={(item) => {
              if (item.promoCode) {
                // Keep browse context — offer is applied at booking checkout.
                return
              }
            }}
          />

          <View style={styles.section}>
            <BusinessTypeStrip
              selected={null}
              availableTypes={availableBusinessTypes}
              onSelect={(type) => {
                if (!type) return
                router.push({
                  pathname: "/category/[type]",
                  params: { type },
                })
              }}
            />
          </View>

          {showHomeSections &&
          featuredSection.salons.length > 0 &&
          gridSalons.length === 0 ? null : (
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="heading">{sectionTitle}</Text>
              {showHomeSections && nearbyAreaGridSalons.length > 0 && areaName ? (
                <Text variant="caption" muted style={{ marginTop: 2 }}>
                  In {areaName}
                </Text>
              ) : locationResult.scopeLabel &&
              !searchQuery.trim() &&
              filters.category === "all" &&
              locationResult.emptyKind === "none" ? (
                <Text variant="caption" muted style={{ marginTop: 2 }}>
                  {locationResult.scopeLabel}
                </Text>
              ) : null}
            </View>
            {searchQuery.trim() ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Text variant="caption" color={colors.coral}>
                  Clear
                </Text>
              </Pressable>
            ) : showLocationEmpty ? null : (
              <Pressable onPress={() => router.push("/services")} hitSlop={8}>
                <Text variant="caption" color={colors.coral}>
                  See all
                </Text>
              </Pressable>
            )}
          </View>
          )}

          {activeFilterCount > 0 || filters.sort !== "recommended" ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {filters.category !== "all" ? (
                <Pressable
                  style={[styles.filterChip, styles.filterChipActive]}
                  onPress={() =>
                    setFilters((prev) => ({ ...prev, category: "all" }))
                  }
                >
                  <Text variant="caption" color={colors.coral}>
                    {filters.category}
                  </Text>
                  <Icon name="close" size={14} color={colors.coral} />
                </Pressable>
              ) : null}
              {filters.price !== "any" ? (
                <Pressable
                  style={[styles.filterChip, styles.filterChipActive]}
                  onPress={() =>
                    setFilters((prev) => ({ ...prev, price: "any" }))
                  }
                >
                  <Text variant="caption" color={colors.coral}>
                    {
                      EXPLORE_PRICE_FILTERS.find((item) => item.id === filters.price)
                        ?.label
                    }
                  </Text>
                  <Icon name="close" size={14} color={colors.coral} />
                </Pressable>
              ) : null}
              {filters.rating !== "any" ? (
                <Pressable
                  style={[styles.filterChip, styles.filterChipActive]}
                  onPress={() =>
                    setFilters((prev) => ({ ...prev, rating: "any" }))
                  }
                >
                  <Text variant="caption" color={colors.coral}>
                    {
                      EXPLORE_RATING_FILTERS.find(
                        (item) => item.id === filters.rating,
                      )?.label
                    }
                  </Text>
                  <Icon name="close" size={14} color={colors.coral} />
                </Pressable>
              ) : null}
              {filters.radius !== "any" ? (
                <Pressable
                  style={[styles.filterChip, styles.filterChipActive]}
                  onPress={() =>
                    setFilters((prev) => ({ ...prev, radius: "any" }))
                  }
                >
                  <Text variant="caption" color={colors.coral}>
                    {
                      EXPLORE_RADIUS_FILTERS.find(
                        (item) => item.id === filters.radius,
                      )?.label
                    }
                  </Text>
                  <Icon name="close" size={14} color={colors.coral} />
                </Pressable>
              ) : null}
              {filters.openOnly ? (
                <Pressable
                  style={[styles.filterChip, styles.filterChipActive]}
                  onPress={() =>
                    setFilters((prev) => ({ ...prev, openOnly: false }))
                  }
                >
                  <Text variant="caption" color={colors.coral}>
                    Open now
                  </Text>
                  <Icon name="close" size={14} color={colors.coral} />
                </Pressable>
              ) : null}
              {filters.sort !== "recommended" ? (
                <Pressable
                  style={[styles.filterChip, styles.filterChipActive]}
                  onPress={() =>
                    setFilters((prev) => ({ ...prev, sort: "recommended" }))
                  }
                >
                  <Text variant="caption" color={colors.coral}>
                    {sortLabel}
                  </Text>
                  <Icon name="close" size={14} color={colors.coral} />
                </Pressable>
              ) : null}
            </ScrollView>
          ) : null}

          <View style={styles.filterBar}>
            <Pressable style={styles.filterChip} onPress={() => setSortOpen(true)}>
              <Icon name="swap-vertical-outline" size={16} color={colors.text} />
              <Text variant="caption" numberOfLines={1}>
                {sortLabel}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterChip,
                activeFilterCount > 0 && styles.filterChipActive,
              ]}
              onPress={() => {
                setDraftFilters(filters)
                setFilterSection("category")
                setFilterOpen(true)
              }}
            >
              <Icon
                name="options-outline"
                size={16}
                color={activeFilterCount > 0 ? colors.coral : colors.text}
              />
              <Text
                variant="caption"
                color={activeFilterCount > 0 ? colors.coral : colors.text}
              >
                Filter
              </Text>
              {activeFilterCount > 0 ? (
                <View style={styles.filterCount}>
                  <Text variant="caption" color={colors.primaryFg}>
                    {activeFilterCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          {showHomeSections && featuredSection.salons.length > 0 ? (
            <FeaturedSalonCarousel salons={featuredSection.salons} />
          ) : null}

          {(catalogLoading && catalog.length === 0) || !locationReady ? (
            <ExploreSalonsSkeleton count={4} />
          ) : catalogError && catalog.length === 0 ? (
            <LocationEmptyState
              variant="network"
              message={catalogError}
              onRetry={() => void loadCatalog(true)}
            />
          ) : showLocationEmpty && locationResult.emptyKind !== "none" ? (
            <LocationEmptyState
              kind={locationResult.emptyKind}
              cityLabel={locationResult.cityLabel}
              onBrowseCity={() => void browseCity()}
              onChangeLocation={openLocationSheet}
            />
          ) : showFilterEmpty || (gridSalons.length === 0 && featuredSection.salons.length === 0) ? (
            <LocationEmptyState
              variant="filters"
              onClearFilters={() => {
                const cleared: ExploreFilterState = {
                  ...DEFAULT_EXPLORE_FILTERS,
                  sort: filters.sort,
                }
                setDraftFilters(cleared)
                setFilters(cleared)
                setSearchQuery("")
              }}
            />
          ) : gridSalons.length === 0 ? null : (
            <>
              <View style={styles.grid}>
                {localGridSalons.map((salon) => (
                  <SalonCard
                    key={salon.id}
                    salon={salon}
                    onPress={() =>
                      router.push({ pathname: "/salon/[id]", params: { id: salon.id } })
                    }
                  />
                ))}
              </View>
              {nearbyAreaGridSalons.length > 0 ? (
                <>
                  <View style={styles.sectionHeader}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="heading">Nearby areas</Text>
                      <Text variant="caption" muted style={{ marginTop: 2 }}>
                        Within {NEARBY_RADIUS_KM} km of {areaName ?? "you"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.grid}>
                    {nearbyAreaGridSalons.map((salon) => (
                      <SalonCard
                        key={salon.id}
                        salon={salon}
                        onPress={() =>
                          router.push({ pathname: "/salon/[id]", params: { id: salon.id } })
                        }
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )}
        </ScrollView>

        <Pressable
          style={[styles.mapPill, showCart && styles.mapPillRaised]}
          onPress={() => setMapOpen(true)}
        >
          <Icon name="map" size={18} color={colors.primaryFg} />
          <Text variant="caption" color={colors.primaryFg}>
            Map
          </Text>
        </Pressable>

        {showCart ? <CartStrip entries={cartEntries} /> : null}
      </View>

      <CartItemsSheet
        visible={cartOpen}
        salonId={activeCartSalonId}
        onClose={() => setCartOpen(false)}
        onContinue={(salonId) =>
          router.push({ pathname: "/book/[salonId]", params: { salonId } })
        }
      />

      <MapOverlay
        visible={mapOpen}
        locationLabel={location}
        salons={mapSalons}
        areaSalons={salons}
        userLatitude={savedLocation?.latitude}
        userLongitude={savedLocation?.longitude}
        onClose={() => setMapOpen(false)}
        onSelectSalon={(id) => {
          router.push({ pathname: "/salon/[id]", params: { id } })
        }}
      />

      <LocationPickerSheet
        visible={locationOpen}
        onClose={closeLocationSheet}
        query={locationDraft}
        onQueryChange={setLocationDraft}
        currentLabel={location}
        nearbyAreas={nearbyAreas}
        nearbyLoading={nearbyLoading}
        predictions={placePredictions}
        placesLoading={placesLoading}
        placesError={placesError}
        nearMeLoading={nearMeLoading}
        onUseCurrentLocation={() => {
          void handleUseCurrentLocation()
        }}
        onPickPrediction={(prediction) => {
          void pickPrediction(prediction)
        }}
      />

      <BottomSheet
        visible={sortOpen}
        title="Sort by"
        onClose={() => setSortOpen(false)}
      >
        {EXPLORE_SORT_FILTERS.map((item) => {
          const active = filters.sort === item.id
          return (
            <Pressable
              key={item.id}
              style={styles.sheetRow}
              onPress={() => {
                setFilters((prev) => ({ ...prev, sort: item.id }))
                setSortOpen(false)
              }}
            >
              <Text color={active ? colors.coral : colors.text}>{item.label}</Text>
              {active ? (
                <Icon name="checkmark" size={18} color={colors.coral} />
              ) : null}
            </Pressable>
          )
        })}
      </BottomSheet>

      <BottomSheet
        visible={filterOpen}
        title="Filters"
        onClose={() => setFilterOpen(false)}
        expanded
        scroll={false}
        footer={
          <View style={styles.filterActions}>
            <Button
              label="Clear all"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                const cleared: ExploreFilterState = {
                  ...DEFAULT_EXPLORE_FILTERS,
                  sort: filters.sort,
                }
                setDraftFilters(cleared)
                setFilters(cleared)
                setFilterOpen(false)
              }}
            />
            <Button
              label={
                draftFilterCount > 0 ? `Apply (${draftFilterCount})` : "Apply"
              }
              style={{ flex: 1 }}
              onPress={() => {
                setFilters(draftFilters)
                setFilterOpen(false)
              }}
            />
          </View>
        }
      >
        <View style={styles.filterSheetBody}>
          <ScrollView
            style={styles.filterNav}
            contentContainerStyle={styles.filterNavContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {FILTER_SECTIONS.map((section) => {
              const active = filterSection === section.id
              const applied =
                (section.id === "category" && draftFilters.category !== "all") ||
                (section.id === "price" && draftFilters.price !== "any") ||
                (section.id === "rating" && draftFilters.rating !== "any") ||
                (section.id === "radius" && draftFilters.radius !== "any") ||
                (section.id === "availability" && draftFilters.openOnly)
              return (
                <Pressable
                  key={section.id}
                  style={[styles.filterNavItem, active && styles.filterNavItemActive]}
                  onPress={() => setFilterSection(section.id)}
                >
                  <Text
                    variant="caption"
                    color={active ? colors.text : colors.textMuted}
                    numberOfLines={2}
                  >
                    {section.label}
                  </Text>
                  {applied ? (
                    <Text variant="caption" color={colors.coral} numberOfLines={1}>
                      Applied
                    </Text>
                  ) : null}
                </Pressable>
              )
            })}
          </ScrollView>

          <ScrollView
            style={styles.filterOptions}
            contentContainerStyle={styles.filterOptionsContent}
            showsVerticalScrollIndicator={false}
            bounces
          >
            {filterSection === "category"
              ? EXPLORE_CATEGORY_FILTERS.filter(
                  (item) =>
                    item.id === "all" ||
                    availableBusinessTypes.includes(item.id),
                ).map((item) => {
                  const active = draftFilters.category === item.id
                  return (
                    <Pressable
                      key={item.id}
                      style={styles.sheetRow}
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          category: item.id,
                        }))
                      }
                    >
                      <Text
                        color={active ? colors.coral : colors.text}
                        style={styles.filterOptionLabel}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {active ? (
                        <Icon name="checkmark" size={18} color={colors.coral} />
                      ) : null}
                    </Pressable>
                  )
                })
              : null}

            {filterSection === "price"
              ? EXPLORE_PRICE_FILTERS.map((item) => {
                  const active = draftFilters.price === item.id
                  return (
                    <Pressable
                      key={item.id}
                      style={styles.sheetRow}
                      onPress={() =>
                        setDraftFilters((prev) => ({ ...prev, price: item.id }))
                      }
                    >
                      <Text
                        color={active ? colors.coral : colors.text}
                        style={styles.filterOptionLabel}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {active ? (
                        <Icon name="checkmark" size={18} color={colors.coral} />
                      ) : null}
                    </Pressable>
                  )
                })
              : null}

            {filterSection === "rating"
              ? EXPLORE_RATING_FILTERS.map((item) => {
                  const active = draftFilters.rating === item.id
                  return (
                    <Pressable
                      key={item.id}
                      style={styles.sheetRow}
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          rating: item.id,
                        }))
                      }
                    >
                      <Text
                        color={active ? colors.coral : colors.text}
                        style={styles.filterOptionLabel}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {active ? (
                        <Icon name="checkmark" size={18} color={colors.coral} />
                      ) : null}
                    </Pressable>
                  )
                })
              : null}

            {filterSection === "radius"
              ? EXPLORE_RADIUS_FILTERS.map((item) => {
                  const active = draftFilters.radius === item.id
                  return (
                    <Pressable
                      key={item.id}
                      style={styles.sheetRow}
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          radius: item.id,
                        }))
                      }
                    >
                      <Text
                        color={active ? colors.coral : colors.text}
                        style={styles.filterOptionLabel}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {active ? (
                        <Icon name="checkmark" size={18} color={colors.coral} />
                      ) : null}
                    </Pressable>
                  )
                })
              : null}

            {filterSection === "availability" ? (
              <>
                <Pressable
                  style={styles.sheetRow}
                  onPress={() =>
                    setDraftFilters((prev) => ({ ...prev, openOnly: false }))
                  }
                >
                  <Text
                    color={!draftFilters.openOnly ? colors.coral : colors.text}
                    style={styles.filterOptionLabel}
                  >
                    Any time
                  </Text>
                  {!draftFilters.openOnly ? (
                    <Icon name="checkmark" size={18} color={colors.coral} />
                  ) : null}
                </Pressable>
                <Pressable
                  style={styles.sheetRow}
                  onPress={() =>
                    setDraftFilters((prev) => ({ ...prev, openOnly: true }))
                  }
                >
                  <Text
                    color={draftFilters.openOnly ? colors.coral : colors.text}
                    style={styles.filterOptionLabel}
                  >
                    Open now
                  </Text>
                  {draftFilters.openOnly ? (
                    <Icon name="checkmark" size={18} color={colors.coral} />
                  ) : null}
                </Pressable>
              </>
            ) : null}
          </ScrollView>
        </View>
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    position: "relative",
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 110,
  },
  scrollWithCart: {
    paddingBottom: 180,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    marginTop: spacing.xxl,
    flexDirection: "row",
    alignItems: "center",
  },
  filterBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  chipRow: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.coral,
    backgroundColor: "#FFF7F5",
  },
  filterCount: {
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    backgroundColor: colors.coral,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  mapPill: {
    position: "absolute",
    alignSelf: "center",
    bottom: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    height: 44,
    backgroundColor: colors.text,
    borderRadius: radii.pill,
  },
  mapPillRaised: {
    bottom: 128,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  filterOptionLabel: {
    flex: 1,
    minWidth: 0,
  },
  filterSheetBody: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0,
    marginHorizontal: -spacing.xl,
  },
  filterNav: {
    width: "38%",
    maxWidth: 148,
    backgroundColor: colors.muted,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  filterNavContent: {
    paddingBottom: spacing.lg,
  },
  filterNavItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  filterNavItemActive: {
    backgroundColor: colors.surface,
    borderLeftWidth: 2,
    borderLeftColor: colors.coral,
  },
  filterOptions: {
    flex: 1,
    minWidth: 0,
  },
  filterOptionsContent: {
    paddingBottom: spacing.lg,
  },
  filterActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
})
