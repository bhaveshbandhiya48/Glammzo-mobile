import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import {
  type Href,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { HomeV4 } from "@/components/home/HomeV4"
import { AllSalonsSection, OffersLabel, SalonFilterChips } from "@/components/home/AllSalonsSection"
import { LocationEmptyState } from "@/components/explore/LocationEmptyState"
import { LocationPickerSheet } from "@/components/explore/LocationPickerSheet"
import { MapOverlay, type KindFilter as MapKindFilter } from "@/components/explore/MapOverlay"
import { ArtistsCarousel } from "@/components/explore/ArtistsCarousel"
import { AppOfferBanners } from "@/components/app-offers/AppOfferBanners"
import { AppOfferDetailsSheet } from "@/components/app-offers/AppOfferDetailsSheet"
import { SalonCarousel } from "@/components/explore/SalonCarousel"
import { SearchSuggestionsPanel } from "@/components/explore/SearchSuggestionsPanel"
import { SalonListRow } from "@/components/home/SalonListRow"
import { SEE_ALL_EMPTY_COLORS, SeeAllEmpty, SheetRadioRow } from "@/components/list/SeeAllParts"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { CartItemsSheet } from "@/components/ui/CartItemsSheet"
import { CartStrip } from "@/components/ui/CartStrip"
import { useCollapseTabBarOnScroll, useFloatingTabBarTop } from "@/components/ui/FloatingTabBar"
import { Icon } from "@/components/ui/Icon"
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
import { salonProfileImageUrl } from "@/data/mocks/salons"
import { ApiError } from "@/lib/api"
import {
  countActiveExploreFilters,
  DEFAULT_EXPLORE_FILTERS,
  EXPLORE_CATEGORY_FILTERS,
  EXPLORE_PRICE_FILTERS,
  EXPLORE_RADIUS_FILTERS,
  EXPLORE_RATING_FILTERS,
  EXPLORE_SORT_FILTERS,
  filterExploreArtists,
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
  HOME_CAROUSEL_LIMIT,
  browseModeFor,
  isCityLevelPlace,
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
  type PlacePrediction,
} from "@/lib/location-api"
import {
  getDeviceCoordinates,
  getDeviceCoordinatesDetailed,
  resolvePlaceFromCoordinates,
} from "@/lib/device-location"
import { artistSlugFromCartId, isArtistCartId } from "@/lib/artist-cart"
import {
  fetchMapArtists,
  prefetchHomeArtists,
  type ArtistCardData,
} from "@/lib/artists-api"
import { fetchSalons, getCatalogSnapshot, hydrateCatalogFromStorage, resolveSalonById } from "@/lib/salons-api"
import { cartServicesSubtotal, formatRupees } from "@/lib/service-pricing"
import {
  getPopularSearches,
  getSearchSuggestions,
} from "@/lib/search-suggestions"
import {
  DEFAULT_SAVED_LOCATION,
  getSignedInDisplayName,
  getSavedLocation,
  peekCachedGreeting,
  setSavedLocation,
  type SavedLocation,
} from "@/lib/user"
import {
  bootstrapLaunchLocation,
  markSessionLocationManual,
  subscribeLaunchLocation,
} from "@/lib/launch-permissions"
import { salonMatchesGenderAudience } from "@/lib/gender-audience"
import { useHomeAudience } from "@/lib/home-audience"
import { registerPushTokenWithServer } from "@/lib/push"
import { fetchHomeAppOffers, type AppOffer } from "@/lib/app-offers-api"
import { colors, fontFamily, radii, spacing } from "@/theme/tokens"

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

/** Longest the pull-to-refresh spinner stays up while the salon list reloads. */
const REFRESH_SPINNER_MAX_MS = 6_000

export default function ExploreScreen() {
  // Floating bar height + its gap over the safe-area inset; content ends ~16pt above it.
  const tabBarTop = useFloatingTabBarTop()
  const onTabBarScroll = useCollapseTabBarOnScroll()
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { category: categoryParam } = useLocalSearchParams<{ category?: string }>()
  const cart = useCart()
  const { isOffline } = useNetwork()
  const [username, setUsername] = useState<string | null>(() =>
    peekCachedGreeting(),
  )
  const [savedLocation, setSavedLocationState] = useState<SavedLocation | null>(null)
  // A whole-city pick lists the whole city; GPS or an address lists salons nearby.
  const locationMode = browseModeFor(savedLocation)
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
  const [mapKind, setMapKind] = useState<MapKindFilter>("all")
  const [mapArtistsRaw, setMapArtistsRaw] = useState<ArtistCardData[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [activeCartSalonId, setActiveCartSalonId] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<Salon[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogReady, setCatalogReady] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [launchSettled, setLaunchSettled] = useState(false)
  const [offerBanners, setOfferBanners] = useState<AppOffer[]>([])
  const [openOffer, setOpenOffer] = useState<AppOffer | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [homeRefreshKey, setHomeRefreshKey] = useState(0)
  const catalogRequest = useRef(0)
  const refreshLock = useRef(false)
  const wasOffline = useRef(false)

  const locationReady = savedLocation != null && launchSettled
  const homeReady = locationReady && catalogReady
  const location = locationReady ? savedLocation.label : "Locating…"

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
      // Show the last catalog right away; the live list replaces it when it arrives.
      setCatalog(cached)
      setCatalogLoading(false)
      setCatalogReady(true)
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
      if (requestId === catalogRequest.current) {
        setCatalogLoading(false)
        setCatalogReady(true)
      }
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      let cancelled = false

      void (async () => {
        const name = await getSignedInDisplayName()
        if (!cancelled) setUsername(name)
      })()

      void (async () => {
        // Returning customer: open Home on the last place now; GPS updates it when ready.
        const existing = await getSavedLocation()
        if (cancelled) return
        if (existing) {
          setSavedLocationState((current) => current ?? existing)
          setLaunchSettled(true)
        }
        // First visit: GPS bootstrap. Later visits: keep saved/manual pick for this session.
        // Only the location: Home doesn't wait for the notification prompt after it.
        await bootstrapLaunchLocation()
        if (cancelled) return
        const saved = (await getSavedLocation()) ?? DEFAULT_SAVED_LOCATION
        if (!cancelled) {
          setSavedLocationState(saved)
          setLaunchSettled(true)
        }
      })()

      void loadCatalog()

      // Start solo-artists in parallel with salons (don’t wait for catalogReady).
      void (async () => {
        const saved = (await getSavedLocation()) ?? DEFAULT_SAVED_LOCATION
        if (cancelled) return
        prefetchHomeArtists(saved.latitude ?? undefined, saved.longitude ?? undefined)
      })()

      return () => {
        cancelled = true
      }
    }, [loadCatalog]),
  )

  useEffect(() => {
    if (!locationReady || !savedLocation) return
    prefetchHomeArtists(
      savedLocation.latitude ?? undefined,
      savedLocation.longitude ?? undefined,
    )
  }, [
    locationReady,
    savedLocation?.latitude,
    savedLocation?.longitude,
  ])

  useEffect(() => {
    if (wasOffline.current && !isOffline) {
      void loadCatalog(true)
    }
    wasOffline.current = isOffline
  }, [isOffline, loadCatalog])

  const loadOfferBanners = useCallback(async () => {
    setOfferBanners(
      await fetchHomeAppOffers({
        city: savedLocation?.city,
        area: savedLocation?.area,
      }),
    )
  }, [savedLocation?.city, savedLocation?.area])

  useEffect(() => {
    let active = true
    void loadOfferBanners().catch(() => {
      if (active) setOfferBanners([])
    })
    return () => {
      active = false
    }
  }, [loadOfferBanners])

  const onHomeRefresh = useCallback(async () => {
    if (refreshLock.current) return
    refreshLock.current = true
    setRefreshing(true)
    // Bump first so artists + next booking refetch in parallel with the catalog.
    setHomeRefreshKey((key) => key + 1)
    // Offers and the greeting update in place when they land; the spinner doesn't wait on them.
    void loadOfferBanners().catch(() => {})
    void getSignedInDisplayName()
      .then((name) => {
        if (name) setUsername(name)
      })
      .catch(() => {})
    try {
      // The spinner follows the salon list, capped so a slow network can't hold it for the
      // full request timeout. A late list still replaces the current one when it arrives.
      await Promise.race([
        loadCatalog(true),
        new Promise<void>((resolve) => setTimeout(resolve, REFRESH_SPINNER_MAX_MS)),
      ])
    } finally {
      setRefreshing(false)
      refreshLock.current = false
    }
  }, [loadCatalog, loadOfferBanners])

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

  // The Home Women / Men switch narrows every salon list and the map.
  const [audience] = useHomeAudience()
  const scopedFiltered = useMemo(() => {
    return filterExploreSalons(
      locationResult.salons.filter((salon) => salonMatchesGenderAudience(salon, audience)),
      filters,
      { query: searchQuery },
    )
  }, [audience, filters, locationResult.salons, searchQuery])

  const salons = useMemo(
    () => sortExploreSalons(scopedFiltered, filters.sort),
    [filters.sort, scopedFiltered],
  )

  /** Map pins: all filtered salons with coordinates. Bottom cards use list `salons` (current area). */
  const mapSalons = useMemo(() => {
    const withDistance = catalog.map((salon) =>
      withSalonDistanceFromLocation(salon, savedLocation),
    )
    const filtered = filterExploreSalons(
      withDistance.filter((salon) => salonMatchesGenderAudience(salon, audience)),
      filters,
      { query: searchQuery },
    )
    return sortExploreSalons(filtered, filters.sort)
  }, [audience, catalog, filters, savedLocation, searchQuery])

  const mapArtists = useMemo(
    () =>
      filterExploreArtists(mapArtistsRaw, filters, {
        query: searchQuery,
      }),
    [filters, mapArtistsRaw, searchQuery],
  )

  const areaMapArtists = useMemo(() => {
    return mapArtists.filter((artist) => {
      if (artist.distanceKm == null || !Number.isFinite(artist.distanceKm)) return true
      return artist.distanceKm <= NEARBY_RADIUS_KM
    })
  }, [mapArtists])

  useEffect(() => {
    if (!mapOpen) return
    let cancelled = false
    const controller = new AbortController()
    void fetchMapArtists({
      latitude: savedLocation?.latitude,
      longitude: savedLocation?.longitude,
      q: searchQuery.trim() || undefined,
      signal: controller.signal,
    }).then((artists) => {
      if (!cancelled) setMapArtistsRaw(artists)
    })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [mapOpen, savedLocation?.latitude, savedLocation?.longitude, searchQuery])

  const activeFilterCount = countActiveExploreFilters(filters)
  const draftFilterCount = countActiveExploreFilters(draftFilters)

  const showHomeSections =
    homeReady &&
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

  const availableBusinessTypes = useMemo(() => {
    const scoped = salonsInSelectedLocation(catalog, savedLocation, locationMode)
    const counts = countSalonsByBusinessType(scoped)
    return BUSINESS_TYPE_ITEMS.map((item) => item.label).filter(
      (label) => (counts.get(label) ?? 0) > 0,
    )
  }, [catalog, savedLocation, locationMode])

  const showLocationEmpty =
    homeReady &&
    locationResult.emptyKind !== "none" &&
    !searchQuery.trim() &&
    filters.category === "all" &&
    activeFilterCount === 0

  const showFilterEmpty =
    homeReady &&
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
  // Home keeps each row short; "See all" opens the full list.
  const homeLocalSalons = showHomeSections
    ? localGridSalons.slice(0, HOME_CAROUSEL_LIMIT)
    : localGridSalons

  const cartEntries = useMemo(() => {
    return cart.carts.flatMap((salonCart) => {
      if (salonCart.kind === "artist" || isArtistCartId(salonCart.salonId)) {
        const lines = salonCart.serviceIds
          .map((id) => salonCart.serviceLines?.[id])
          .filter((line): line is NonNullable<typeof line> => Boolean(line))
        if (lines.length === 0 && salonCart.serviceIds.length === 0) return []
        const total = lines.reduce((sum, line) => sum + (Number(line.price) || 0), 0)
        const preview = lines
          .map((line) => line.name)
          .slice(0, 2)
          .join(", ")
        const itemCount = salonCart.serviceIds.length
        if (itemCount === 0) return []
        return [
          {
            salonId: salonCart.salonId,
            salonName: salonCart.providerName?.trim() || "Solo artist",
            itemCount,
            totalLabel: formatRupees(total),
            imageUrls: salonCart.providerImageUrl ? [salonCart.providerImageUrl] : [],
            previewLabel: preview || `${itemCount} services`,
            onPress: () => {
              setActiveCartSalonId(salonCart.salonId)
              setCartOpen(true)
            },
            onClear: () => cart.clearSalon(salonCart.salonId),
          },
        ]
      }

      const salon = resolveSalonById(salonCart.salonId)
      if (!salon) return []
      const services = salon.services.filter((service) =>
        salonCart.serviceIds.includes(service.id),
      )
      const selectedPackage = salonCart.packageId
        ? salon.packages.find((item) => item.id === salonCart.packageId)
        : undefined
      const total = cartServicesSubtotal(
        salon.services,
        salonCart.serviceIds,
        selectedPackage ?? null,
        salonCart.quantities,
        salonCart.priceOptionIds,
      )
      const profileImage = salonProfileImageUrl(salon)
      const images = profileImage ? [profileImage] : []
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
          totalLabel: `${formatRupees(total)}`,
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
          const coords = await getDeviceCoordinates({ promptIfNeeded: false })
          if (!coords) {
            if (!cancelled) setNearbyAreas([])
            return
          }
          lat = coords.latitude
          lng = coords.longitude
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

  function openFilterSheet() {
    setDraftFilters(filters)
    setFilterSection("category")
    setFilterOpen(true)
  }

  function clearFilters() {
    const cleared: ExploreFilterState = { ...DEFAULT_EXPLORE_FILTERS, sort: filters.sort }
    setDraftFilters(cleared)
    setFilters(cleared)
  }

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
    setPlacePredictions([])
    setPlacesError(null)
    setLocationOpen(false)
    placesSession.current = createPlacesSessionToken()
    // New place: reload now rather than on the next visit to this screen.
    setMapArtistsRaw([])
    setHomeRefreshKey((key) => key + 1)
    void loadCatalog(true)
    void registerPushTokenWithServer().catch(() => undefined)
  }

  async function browseCity() {
    const city = locationResult.cityLabel?.trim()
    if (!city) return
    const next: SavedLocation = {
      ...(savedLocation ?? { label: city }),
      label: city,
      city,
      area: undefined,
      scope: "city",
    }
    markSessionLocationManual()
    await setSavedLocation(next)
    setSavedLocationState(next)
    void registerPushTokenWithServer().catch(() => undefined)
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
        scope: isCityLevelPlace(place) ? "city" : undefined,
      })
    } catch (err) {
      setPlacesError(
        err instanceof ApiError ? err.message : "Could not resolve that place.",
      )
    } finally {
      setPlacesLoading(false)
    }
  }

  /** Map's locate button: the map has already moved, so a failed place lookup just keeps the old label. */
  async function applyDeviceCoords(coords: { latitude: number; longitude: number }) {
    try {
      const place = await resolvePlaceFromCoordinates(coords)
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
    } catch {
      // Keep the current label; the map is already showing the phone's position.
    }
  }

  async function handleUseCurrentLocation() {
    setNearMeLoading(true)
    setPlacesError(null)
    try {
      const result = await getDeviceCoordinatesDetailed({ promptIfNeeded: true })
      if (!result.ok) {
        if (result.reason === "permission_denied") {
          setPlacesError("Location permission is required to use current location.")
        } else if (result.reason === "services_off") {
          setPlacesError("Turn on location in your phone settings to use current location.")
        } else {
          setPlacesError("Could not detect your current location. Try again in a moment.")
        }
        return
      }
      const place = await resolvePlaceFromCoordinates(result.coords)
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
    } catch {
      setPlacesError("Could not detect your current location. Try again in a moment.")
    } finally {
      setNearMeLoading(false)
    }
  }

  return (
    <View style={styles.root}>
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
          onScroll={onTabBarScroll}
          scrollEventThrottle={16}
          bounces
          alwaysBounceVertical
          overScrollMode="always"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingBottom: tabBarTop + (showCart ? 88 : spacing.lg) }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onHomeRefresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          }
        >
          <HomeV4
            username={username}
            location={locationReady ? savedLocation : null}
            searchQuery={searchQuery}
            showSections={homeReady && !searchQuery.trim()}
            salons={locationResult.salons}
            refreshKey={homeRefreshKey}
            onSearchPress={openSearch}
            onClearSearch={() => setSearchQuery("")}
            onLocationPress={openLocationSheet}
          />

          {homeReady &&
          !searchQuery.trim() &&
          offerBanners.some((item) => Boolean(item.bannerUrl)) ? (
            <OffersLabel />
          ) : null}

          {homeReady && !searchQuery.trim() ? (
            <AppOfferBanners
              offers={offerBanners}
              onPressOffer={(offer) => {
                if (offer.tapTarget === "salons") router.push("/salons" as Href)
                else if (offer.tapTarget === "artists") router.push("/artists" as Href)
                else setOpenOffer(offer)
              }}
            />
          ) : null}

          {homeReady && searchQuery.trim() ? (
            <View style={styles.searchChips}>
              <SalonFilterChips
                filters={filters}
                onChange={setFilters}
                onOpenFilters={openFilterSheet}
                onOpenSort={() => setSortOpen(true)}
                onClearAll={clearFilters}
              />
            </View>
          ) : null}

          {(catalogLoading && catalog.length === 0) || !homeReady ? (
            <ExploreSalonsSkeleton count={4} />
          ) : catalogError && catalog.length === 0 ? (
            <LocationEmptyState
              variant="network"
              message={catalogError}
              onRetry={() => void loadCatalog(true)}
            />
          ) : showLocationEmpty && locationResult.emptyKind !== "none" ? (
            // No salons here: same Salons / Artists tabs as always. The section opens on Artists when
            // there are any, and the Salons tab shows the location empty state.
            <AllSalonsSection
              salons={[]}
              location={savedLocation}
              areaLabel={areaName ?? locationResult.cityLabel}
              filters={filters}
              onChange={setFilters}
              onOpenFilters={openFilterSheet}
              onOpenSort={() => setSortOpen(true)}
              onClearAll={clearFilters}
              onOpenMap={(mode) => {
                setMapKind(mode === "artists" ? "artist" : "all")
                setMapOpen(true)
              }}
              emptyState={
                <LocationEmptyState
                  kind={locationResult.emptyKind}
                  cityLabel={locationResult.cityLabel}
                  onBrowseCity={() => void browseCity()}
                  onChangeLocation={openLocationSheet}
                  artistsShown={false}
                />
              }
            />
          ) : searchQuery.trim() && activeFilterCount === 0 && gridSalons.length === 0 ? (
            <View style={styles.bleed}>
              <SeeAllEmpty
                icon="search-outline"
                colors={SEE_ALL_EMPTY_COLORS.salons}
                title={`No salons for “${searchQuery.trim()}” nearby`}
                body="Try another word, like haircut or facial. Solo artists who offer it show below."
                actionLabel="Clear search"
                onAction={() => setSearchQuery("")}
              />
            </View>
          ) : !searchQuery.trim() ? (
            <AllSalonsSection
              salons={scopedFiltered}
              location={savedLocation}
              areaLabel={areaName ?? locationResult.cityLabel}
              filters={filters}
              onChange={setFilters}
              onOpenFilters={openFilterSheet}
              onOpenSort={() => setSortOpen(true)}
              onClearAll={clearFilters}
              onOpenMap={(mode) => {
                setMapKind(mode === "artists" ? "artist" : "all")
                setMapOpen(true)
              }}
              onSeeAll={() => router.push("/salons")}
              emptyState={<LocationEmptyState variant="filters" onClearFilters={clearFilters} />}
            />
          ) : showFilterEmpty ||
            (gridSalons.length === 0 && featuredSection.salons.length === 0) ? (
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
          ) : (
            <>
              {searchQuery.trim() && localGridSalons.length > 0 ? (
                <View style={styles.results}>
                  <View style={styles.resultsHeader}>
                    <Text style={styles.resultsTitle} accessibilityRole="header" numberOfLines={2}>
                      {sectionTitle}
                    </Text>
                    <Text style={styles.resultsSubtitle} numberOfLines={1}>
                      {`${localGridSalons.length} ${localGridSalons.length === 1 ? "salon" : "salons"}${
                        areaName ? ` · ${areaName}` : ""
                      }`}
                    </Text>
                  </View>
                  {localGridSalons.map((salon) => (
                    <View key={salon.id} style={styles.resultRow}>
                      <SalonListRow salon={salon} featured={salon.isFeatured === true} />
                    </View>
                  ))}
                </View>
              ) : localGridSalons.length > 0 ? (
                <SalonCarousel
                  title={sectionTitle}
                  subtitle={
                    showHomeSections && nearbyAreaGridSalons.length > 0 && areaName
                      ? `In ${areaName}`
                      : locationResult.scopeLabel &&
                          !searchQuery.trim() &&
                          filters.category === "all" &&
                          locationResult.emptyKind === "none"
                        ? locationResult.scopeLabel
                        : undefined
                  }
                  salons={homeLocalSalons}
                  onSeeAll={
                    searchQuery.trim() ? undefined : () => router.push("/salons")
                  }
                />
              ) : null}
            </>
          )}

          {homeReady && searchQuery.trim() && filters.category === "all" ? (
            <ArtistsCarousel
              query={searchQuery}
              latitude={savedLocation?.latitude}
              longitude={savedLocation?.longitude}
              refreshKey={homeRefreshKey}
            />
          ) : null}
        </ScrollView>

        {showCart ? <CartStrip entries={cartEntries} aboveTabBar /> : null}
        {/* Home header scrolls; keep the status bar area readable (matches the header's top colour). */}
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: "#fdf3ee" }}
        />
      </View>

      <CartItemsSheet
        visible={cartOpen}
        salonId={activeCartSalonId}
        onClose={() => setCartOpen(false)}
        onContinue={(salonId) => {
          const slug = artistSlugFromCartId(salonId)
          if (slug) {
            const artistCart = cart.getCart(salonId)
            router.push({
              pathname: "/artist/book/[slug]",
              params: {
                slug,
                serviceIds: (artistCart?.serviceIds ?? []).join(","),
              },
            })
            return
          }
          router.push({ pathname: "/book/[salonId]", params: { salonId } })
        }}
      />

      <MapOverlay
        visible={mapOpen}
        locationLabel={location}
        salons={mapSalons}
        areaSalons={salons}
        artists={mapArtists}
        areaArtists={areaMapArtists}
        userLatitude={savedLocation?.latitude}
        userLongitude={savedLocation?.longitude}
        onClose={() => setMapOpen(false)}
        onChangeLocation={openLocationSheet}
        onUseCoords={(coords) => void applyDeviceCoords(coords)}
        onSelectSalon={(id) => {
          router.push({ pathname: "/salon/[id]", params: { id } })
        }}
        onSelectArtist={(slug) => {
          router.push({ pathname: "/artist/[slug]", params: { slug } })
        }}
        initialKind={mapKind}
      />

      <LocationPickerSheet
        visible={locationOpen}
        focusOnOpen={mapOpen}
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
        <View accessibilityRole="radiogroup" accessibilityLabel="Sort by">
          {EXPLORE_SORT_FILTERS.map((item, index) => (
            <SheetRadioRow
              key={item.id}
              label={item.label}
              on={filters.sort === item.id}
              last={index === EXPLORE_SORT_FILTERS.length - 1}
              onPress={() => {
                setFilters((prev) => ({ ...prev, sort: item.id }))
                setSortOpen(false)
              }}
            />
          ))}
        </View>
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
                  accessibilityRole="button"
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
                    <Text variant="caption" color={colors.primary} numberOfLines={1}>
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
                      accessibilityRole="button"
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
                        color={active ? colors.primary : colors.text}
                        style={styles.filterOptionLabel}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {active ? (
                        <Icon name="checkmark" size={18} color={colors.primary} />
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
                      accessibilityRole="button"
                      key={item.id}
                      style={styles.sheetRow}
                      onPress={() =>
                        setDraftFilters((prev) => ({ ...prev, price: item.id }))
                      }
                    >
                      <Text
                        color={active ? colors.primary : colors.text}
                        style={styles.filterOptionLabel}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {active ? (
                        <Icon name="checkmark" size={18} color={colors.primary} />
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
                      accessibilityRole="button"
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
                        color={active ? colors.primary : colors.text}
                        style={styles.filterOptionLabel}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {active ? (
                        <Icon name="checkmark" size={18} color={colors.primary} />
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
                      accessibilityRole="button"
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
                        color={active ? colors.primary : colors.text}
                        style={styles.filterOptionLabel}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {active ? (
                        <Icon name="checkmark" size={18} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  )
                })
              : null}

            {filterSection === "availability" ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  style={styles.sheetRow}
                  onPress={() =>
                    setDraftFilters((prev) => ({ ...prev, openOnly: false }))
                  }
                >
                  <Text
                    color={!draftFilters.openOnly ? colors.primary : colors.text}
                    style={styles.filterOptionLabel}
                  >
                    Any time
                  </Text>
                  {!draftFilters.openOnly ? (
                    <Icon name="checkmark" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.sheetRow}
                  onPress={() =>
                    setDraftFilters((prev) => ({ ...prev, openOnly: true }))
                  }
                >
                  <Text
                    color={draftFilters.openOnly ? colors.primary : colors.text}
                    style={styles.filterOptionLabel}
                  >
                    Open now
                  </Text>
                  {draftFilters.openOnly ? (
                    <Icon name="checkmark" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              </>
            ) : null}
          </ScrollView>
        </View>
      </BottomSheet>

      <AppOfferDetailsSheet
        offer={openOffer}
        onClose={() => setOpenOffer(null)}
        ctaLabel="Find a salon"
        onPressCta={() => router.push("/salons" as Href)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
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
  // Owns its gap, so nothing is left above the banner when there is no upcoming visit.
  nextVisit: {
    marginBottom: spacing.md,
  },
  // SalonFilterChips pads 20 itself; run it edge to edge.
  searchChips: {
    marginHorizontal: -spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  bleed: {
    marginHorizontal: -spacing.lg,
    paddingBottom: spacing.lg,
  },
  results: {
    marginHorizontal: -spacing.lg,
    marginTop: spacing.xs,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  resultsTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: "#111111",
  },
  resultsSubtitle: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
  },
  resultRow: {
    paddingHorizontal: 20,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    marginTop: spacing.xxl,
    flexDirection: "row",
    alignItems: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.md,
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
    borderLeftColor: colors.primary,
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
