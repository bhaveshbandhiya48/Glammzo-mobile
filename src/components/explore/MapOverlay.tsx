import { formatRupees } from "@/lib/service-pricing"
import Constants from "expo-constants"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from "react-native"
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { formatKm } from "@/components/home/HomeNextBookingCard"
import { PhotoOrFallback } from "@/components/home/PhotoFallback"
import { artistWhereLabel } from "@/components/home/ArtistListRow"
import { salonPriceLine } from "@/components/home/SalonListRow"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Salon } from "@/data/types"
import type { ArtistCardData } from "@/lib/artists-api"
import { getDeviceCoordinatesDetailed } from "@/lib/device-location"
import { NEARBY_RADIUS_KM } from "@/lib/explore-location"
import { GLAMMZO_MAP_STYLE } from "@/lib/map-styles"
import { colors, fontFamily, radii, spacing } from "@/theme/tokens"

/** One card at a time, with the next one peeking in. */
const SIDE_PAD = spacing.lg
const CARD_GAP = spacing.sm
const CARD_WIDTH = Dimensions.get("window").width - SIDE_PAD * 2 - spacing.lg
const CARD_HEIGHT = 112
const CARD_PHOTO = CARD_HEIGHT - 24
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP
/** How long after a location change the map keeps framing newly loaded pins. */
const FIT_NEW_AREA_MS = 6000
const DEFAULT_CENTER = { latitude: 12.9716, longitude: 77.5946 }

type Props = {
  visible: boolean
  locationLabel: string
  /** All filtered salons with pins (may include outside the current area). */
  salons: Salon[]
  /** Used to open the camera on the user's current browse area. */
  areaSalons: Salon[]
  /** Filtered solo artists with map pins. */
  artists?: ArtistCardData[]
  /** Artists in the current browse area (camera fit). */
  areaArtists?: ArtistCardData[]
  userLatitude?: number
  userLongitude?: number
  onClose: () => void
  /** Opens the location search. */
  onChangeLocation: () => void
  /** The phone's position was found: make it the browse location. */
  onUseCoords: (coords: { latitude: number; longitude: number }) => void
  onSelectSalon: (salonId: string) => void
  onSelectArtist?: (slug: string) => void
  /** Pin filter the map opens on (e.g. "artist" from Home's Artists list). Default "all". */
  initialKind?: KindFilter
}

export type KindFilter = "all" | "salon" | "artist" | "home"

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "salon", label: "Salons" },
  { id: "artist", label: "Artists" },
  { id: "home", label: "At home" },
]

/** "Salons near Indiranagar": what the map is showing, for the search pill. */
function summaryTitle(kind: KindFilter, area: string) {
  const what =
    kind === "salon" ? "Salons" : kind === "artist" ? "Artists" : kind === "home" ? "At-home artists" : "Places"
  return `${what} near ${area}`
}

type MapPin = {
  id: string
  kind: "salon" | "artist"
  latitude: number
  longitude: number
  price: number
  name: string
  place: string | null
  rating: number | null
  distanceKm: number | null
  imageUrl: string | null
  salonId?: string
  artistSlug?: string
  /** Card lines, worked out like SalonListRow / ArtistListRow. */
  meta: string | null
  priceLine: string | null
  offersHomeVisits: boolean
}

function regionAroundPoint(
  latitude: number,
  longitude: number,
  radiusKm: number,
): Region {
  const latDelta = Math.max(0.04, (radiusKm * 2.4) / 111)
  const lngDelta = Math.max(
    0.04,
    latDelta / Math.max(0.2, Math.cos((latitude * Math.PI) / 180)),
  )
  return {
    latitude,
    longitude,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  }
}

function regionForPins(pins: MapPin[]): Region {
  const lats = pins.map((item) => item.latitude)
  const lngs = pins.map((item) => item.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.04, (maxLat - minLat) * 1.6 || 0.08),
    longitudeDelta: Math.max(0.04, (maxLng - minLng) * 1.6 || 0.08),
  }
}

/** True when a pin sits inside the map camera (with a small edge pad). */
function isPinInRegion(pin: MapPin, region: Region, padRatio = 0.08) {
  const latPad = region.latitudeDelta * padRatio
  const lngPad = region.longitudeDelta * padRatio
  const minLat = region.latitude - region.latitudeDelta / 2 - latPad
  const maxLat = region.latitude + region.latitudeDelta / 2 + latPad
  const minLng = region.longitude - region.longitudeDelta / 2 - lngPad
  const maxLng = region.longitude + region.longitudeDelta / 2 + lngPad
  return (
    pin.latitude >= minLat &&
    pin.latitude <= maxLat &&
    pin.longitude >= minLng &&
    pin.longitude <= maxLng
  )
}

function pinsInRegion(pins: MapPin[], region: Region) {
  return pins.filter((pin) => isPinInRegion(pin, region))
}

function isSameRegion(a: Region, b: Region) {
  const epsilon = 0.00008
  return (
    Math.abs(a.latitude - b.latitude) < epsilon &&
    Math.abs(a.longitude - b.longitude) < epsilon &&
    Math.abs(a.latitudeDelta - b.latitudeDelta) < epsilon &&
    Math.abs(a.longitudeDelta - b.longitudeDelta) < epsilon
  )
}

/** Keep list order stable and never drop the pin the user just picked. */
function carouselPinsForRegion(
  pins: MapPin[],
  region: Region,
  selectedId: string | null,
) {
  const visible = pinsInRegion(pins, region)
  if (!selectedId || visible.some((item) => item.id === selectedId)) {
    return visible
  }
  const keep = new Set(visible.map((item) => item.id))
  keep.add(selectedId)
  return pins.filter((item) => keep.has(item.id))
}

function salonCoords(salon: Salon): { latitude: number; longitude: number } | null {
  if (
    salon.latitude == null ||
    salon.longitude == null ||
    !Number.isFinite(salon.latitude) ||
    !Number.isFinite(salon.longitude)
  ) {
    return null
  }
  return { latitude: salon.latitude, longitude: salon.longitude }
}

function artistCoords(
  artist: ArtistCardData,
): { latitude: number; longitude: number } | null {
  if (
    artist.latitude == null ||
    artist.longitude == null ||
    !Number.isFinite(artist.latitude) ||
    !Number.isFinite(artist.longitude)
  ) {
    return null
  }
  return { latitude: artist.latitude, longitude: artist.longitude }
}

function salonToPin(salon: Salon): MapPin | null {
  const coords = salonCoords(salon)
  if (!coords) return null
  return {
    id: `salon:${salon.id}`,
    kind: "salon",
    ...coords,
    price: salon.priceFrom,
    name: salon.name,
    place: salon.area || null,
    rating: salon.rating > 0 ? salon.rating : null,
    distanceKm: salon.distanceKm > 0 ? salon.distanceKm : null,
    imageUrl: salon.coverImageUrl?.trim() || salon.imageUrl || null,
    salonId: salon.id,
    meta: [salon.area || null, formatKm(salon.distanceKm)].filter(Boolean).join(" · ") || null,
    priceLine: salonPriceLine(salon),
    offersHomeVisits: false,
  }
}

function artistToPin(artist: ArtistCardData): MapPin | null {
  const coords = artistCoords(artist)
  if (!coords) return null
  return {
    id: `artist:${artist.slug}`,
    kind: "artist",
    ...coords,
    price: artist.startingPrice ?? 0,
    name: artist.displayName,
    place: artist.area || null,
    rating:
      (artist.reviewCount ?? 0) > 0 && artist.averageRating != null
        ? artist.averageRating
        : null,
    distanceKm: artist.distanceKm,
    imageUrl:
      artist.profilePhotoUrl?.trim() || artist.portfolio?.find((url) => url?.trim()) || null,
    artistSlug: artist.slug,
    meta: [artistWhereLabel(artist), formatKm(artist.distanceKm)].filter(Boolean).join(" · ") || null,
    priceLine:
      artist.startingPrice != null && artist.startingPrice > 0
        ? `From ${formatRupees(artist.startingPrice)}`
        : null,
    offersHomeVisits: Boolean(artist.offersHomeVisits),
  }
}

function useGoogleMapsProvider() {
  const extra = Constants.expoConfig?.extra as
    | {
        googleMapsApiKey?: string
        googleMapsApiKeyIos?: string
        googleMapsApiKeyAndroid?: string
      }
    | undefined
  const key =
    (Platform.OS === "ios"
      ? extra?.googleMapsApiKeyIos
      : extra?.googleMapsApiKeyAndroid) ||
    extra?.googleMapsApiKey ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  // Android always uses Google in Expo Go / builds.
  // iOS: Google only when a Maps API key is configured (custom styles need Google).
  if (Platform.OS === "android") return PROVIDER_GOOGLE
  if (typeof key === "string" && key.trim().length > 0) return PROVIDER_GOOGLE
  return undefined
}

function pinLabel(pin: { price: number; name: string; rating: number | null }) {
  const price = Number(pin.price) || 0
  if (price > 0) return formatRupees(price)
  if (pin.rating != null) return `★ ${pin.rating.toFixed(1)}`
  // No price or rating yet: the name says more than an empty pin.
  return pin.name.length > 12 ? `${pin.name.slice(0, 11).trim()}…` : pin.name
}

function pricePinMinWidth(label: string, selected = false) {
  // Android Google Maps snapshots custom markers into a bitmap and often
  // under-measures RN views, which clips multi-digit prices mid-glyph.
  const charWidth = Platform.OS === "android" ? 11 : 8
  const horizontalPad = Platform.OS === "android" ? 32 : 24
  const floor = Platform.OS === "android" ? 72 : 56
  const width = Math.max(floor, Math.ceil(horizontalPad + label.length * charWidth))
  // The selected pin is drawn a touch larger.
  return selected ? width + 8 : width
}

/** Fixed Android height, with room for the bitmap capture. */
const ANDROID_PIN_HEIGHT = 36
const ANDROID_PIN_HEIGHT_SELECTED = 40

function PricePin({ label, selected }: { label: string; selected: boolean }) {
  const width = pricePinMinWidth(label, selected)
  const height = selected ? ANDROID_PIN_HEIGHT_SELECTED : ANDROID_PIN_HEIGHT

  return (
    <View
      style={[
        styles.pricePin,
        Platform.OS === "android" ? { width, height } : { minWidth: width },
        selected && styles.pricePinSelected,
      ]}
      collapsable={false}
      renderToHardwareTextureAndroid
    >
      <RNText
        numberOfLines={1}
        allowFontScaling={false}
        style={[
          styles.pricePinText,
          Platform.OS === "android" && styles.pricePinTextAndroid,
          selected && styles.pricePinTextSelected,
          { color: selected ? "#FFFFFF" : INK },
        ]}
      >
        {label}
      </RNText>
    </View>
  )
}

/** Remounts + tracks redraw so selected pins don’t snapshot blank. */
function MapPriceMarker({
  pinId,
  label,
  latitude,
  longitude,
  selected,
  onPress,
}: {
  pinId: string
  label: string
  latitude: number
  longitude: number
  selected: boolean
  onPress: () => void
}) {
  // Android: keep tracking until layout settles; never leave true forever (CPU).
  const [tracksViewChanges, setTracksViewChanges] = useState(true)

  useEffect(() => {
    setTracksViewChanges(true)
    const timer = setTimeout(
      () => setTracksViewChanges(false),
      Platform.OS === "android" ? 2200 : 900,
    )
    return () => clearTimeout(timer)
  }, [selected, label, pinId])

  return (
    <Marker
      identifier={`${pinId}-${selected ? "on" : "off"}`}
      coordinate={{ latitude, longitude }}
      onPress={(event) => {
        event.stopPropagation?.()
        onPress()
      }}
      tracksViewChanges={tracksViewChanges}
      zIndex={selected ? 1000 : 1}
      anchor={{ x: 0.5, y: 0.5 }}
      {...(Platform.OS === "android"
        ? {
            style: {
              width: pricePinMinWidth(label, selected),
              height: selected ? ANDROID_PIN_HEIGHT_SELECTED : ANDROID_PIN_HEIGHT,
              overflow: "visible" as const,
            },
          }
        : null)}
    >
      <PricePin label={label} selected={selected} />
    </Marker>
  )
}

/** Floating tap card: the SalonListRow / ArtistListRow content on a white card. */
function MapListingCard({ pin, onOpen }: { pin: MapPin; onOpen: () => void }) {
  const kindLabel = pin.kind === "artist" ? "Artist" : "Salon"
  const metaLine = [kindLabel, pin.meta].filter(Boolean).join(" · ")
  const fallbackPrice = pin.price > 0 ? `From ${formatRupees(pin.price)}` : null
  const priceLine = pin.priceLine ?? fallbackPrice

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.listingCard, pressed && styles.listingCardPressed]}
      accessibilityRole="button"
      accessibilityLabel={[
        pin.name,
        pin.rating != null ? `rated ${pin.rating.toFixed(1)}` : "new",
        metaLine,
        priceLine,
      ]
        .filter(Boolean)
        .join(". ")}
      accessibilityHint="Opens the details"
    >
      <View style={styles.listingImage}>
        <PhotoOrFallback uri={pin.imageUrl} name={pin.name} />
      </View>
      <View style={styles.listingBody}>
        <View style={styles.listingNameRow}>
          <RNText style={styles.listingName} numberOfLines={1}>
            {pin.name}
          </RNText>
          <View style={styles.ratingPill}>
            <RNText style={styles.ratingText}>
              {pin.rating != null ? `${pin.rating.toFixed(1)}★` : "New"}
            </RNText>
          </View>
        </View>
        {metaLine ? (
          <RNText style={styles.listingMeta} numberOfLines={1}>
            {metaLine}
          </RNText>
        ) : null}
        {priceLine ? (
          <RNText style={styles.listingPrice} numberOfLines={1}>
            {priceLine}
          </RNText>
        ) : null}
      </View>
    </Pressable>
  )
}

export function MapOverlay({
  visible,
  locationLabel,
  salons,
  areaSalons,
  artists = [],
  areaArtists = [],
  userLatitude,
  userLongitude,
  onClose,
  onChangeLocation,
  onUseCoords,
  onSelectSalon,
  onSelectArtist,
  initialKind = "all",
}: Props) {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView | null>(null)
  const carouselRef = useRef<ScrollViewInstance | null>(null)
  const programmaticCameraUntilRef = useRef(0)
  const ignoreScrollUntilRef = useRef(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Null until the customer picks a filter on the map; until then it opens on `initialKind`.
  const [pickedKind, setKindFilter] = useState<KindFilter | null>(null)
  const kindFilter = pickedKind ?? initialKind
  const showSalons = kindFilter === "all" || kindFilter === "salon"
  const showArtists = kindFilter !== "salon"
  const homeOnly = kindFilter === "home"
  // The customer tapped the map to put the card away: keep it away until they pick a pin.
  const [dismissed, setDismissed] = useState(false)
  const [viewRegion, setViewRegion] = useState<Region | null>(null)
  const [liveUserCoords, setLiveUserCoords] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateMessage, setLocateMessage] = useState<string | null>(null)
  // Only a swipe should move the map to a card; programmatic scrolls also end with momentum.
  const carouselDragged = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const provider = useGoogleMapsProvider()
  const useCustomStyle = provider === PROVIDER_GOOGLE
  const mappableRef = useRef<MapPin[]>([])
  const dismissedRef = useRef(false)
  dismissedRef.current = dismissed

  const mappable = useMemo(() => {
    const salonPins = showSalons
      ? salons.map(salonToPin).filter((item): item is MapPin => item != null)
      : []
    const artistPins = showArtists
      ? artists
          .map(artistToPin)
          .filter((item): item is MapPin => item != null && (!homeOnly || item.offersHomeVisits))
      : []
    return [...salonPins, ...artistPins]
  }, [salons, artists, showSalons, showArtists, homeOnly])
  mappableRef.current = mappable

  const areaIdSet = useMemo(() => {
    const ids = new Set<string>()
    if (showSalons) {
      for (const salon of areaSalons) ids.add(`salon:${salon.id}`)
    }
    if (showArtists) {
      for (const artist of areaArtists) ids.add(`artist:${artist.slug}`)
    }
    return ids
  }, [areaSalons, areaArtists, showSalons, showArtists])

  const areaMappable = useMemo(
    () => mappable.filter((item) => areaIdSet.has(item.id)),
    [areaIdSet, mappable],
  )

  useEffect(() => {
    if (!selectedId) return
    if (!mappable.some((pin) => pin.id === selectedId)) {
      setSelectedId(mappable[0]?.id ?? null)
    }
  }, [mappable, selectedId])

  const initialRegion: Region = useMemo(() => {
    if (areaMappable.length > 0) {
      return regionForPins(areaMappable)
    }
    if (
      Number.isFinite(userLatitude) &&
      Number.isFinite(userLongitude)
    ) {
      return regionAroundPoint(
        userLatitude!,
        userLongitude!,
        NEARBY_RADIUS_KM,
      )
    }
    return {
      ...DEFAULT_CENTER,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    }
  }, [areaMappable, userLatitude, userLongitude])

  const activeRegion = viewRegion ?? initialRegion

  /** Airbnb-style: bottom cards follow salons in the visible map camera. */
  const carouselItems = useMemo(
    () => carouselPinsForRegion(mappable, activeRegion, selectedId),
    [activeRegion, mappable, selectedId],
  )
  const selectedCarouselIndex = useMemo(
    () => carouselItems.findIndex((item) => item.id === selectedId),
    [carouselItems, selectedId],
  )

  const hasPlacesInView = carouselItems.length > 0
  const showCarousel = hasPlacesInView && !dismissed && selectedId != null
  const showListPill = hasPlacesInView && !showCarousel
  const placeCount = carouselItems.length
  // Pins arrive just after a move, so wait a moment before saying there are none.
  const [emptyReady, setEmptyReady] = useState(false)
  useEffect(() => {
    setEmptyReady(false)
    if (!visible || hasPlacesInView) return
    const timer = setTimeout(() => setEmptyReady(true), 900)
    return () => clearTimeout(timer)
  }, [visible, hasPlacesInView, locationLabel])
  const finding = visible && !hasPlacesInView && !emptyReady

  const markerLatitude = liveUserCoords?.latitude ?? userLatitude
  const markerLongitude = liveUserCoords?.longitude ?? userLongitude
  const hasUserMarker =
    Number.isFinite(markerLatitude) && Number.isFinite(markerLongitude)
  const hasSavedUserCoords =
    Number.isFinite(userLatitude) && Number.isFinite(userLongitude)

  const bottomInset = Math.max(insets.bottom, spacing.md)
  const bottomChrome = (showCarousel ? CARD_HEIGHT + spacing.xl : spacing.xxl + 24) + bottomInset

  useEffect(() => {
    if (!visible) {
      setSelectedId(null)
      setDismissed(false)
      setKindFilter(null)
      setViewRegion(null)
      setLiveUserCoords(null)
      setLocateMessage(null)
      setMapReady(false)
      return
    }

    // Init once per open: fit current area; cards then sync via region changes.
    setViewRegion(initialRegion)
    setSelectedId(areaMappable[0]?.id ?? null)
    programmaticCameraUntilRef.current = Date.now() + 900
    ignoreScrollUntilRef.current = Date.now() + 500
    const pins = areaMappable
    const region = initialRegion
    const topPad = insets.top + 132
    const bottomPad =
      (pins.length > 0 ? CARD_HEIGHT + spacing.xl : spacing.xxl) +
      Math.max(insets.bottom, spacing.md) +
      24

    const timer = setTimeout(() => {
      if (pins.length > 0) {
        mapRef.current?.fitToCoordinates(
          pins.map((item) => ({
            latitude: item.latitude,
            longitude: item.longitude,
          })),
          {
            edgePadding: {
              top: topPad,
              right: 40,
              bottom: bottomPad,
              left: 40,
            },
            animated: true,
          },
        )
        return
      }
      mapRef.current?.animateToRegion(region, 350)
    }, 280)
    return () => clearTimeout(timer)
    // Intentionally only re-init when the overlay opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  // New location picked while the map is open: move there; its pins follow as they load.
  const lastCoordsRef = useRef<string | null>(null)
  const fitNewAreaUntilRef = useRef(0)
  useEffect(() => {
    const coords = `${userLatitude},${userLongitude}`
    const changed = lastCoordsRef.current != null && lastCoordsRef.current !== coords
    lastCoordsRef.current = visible ? coords : null
    if (!visible || !changed || !Number.isFinite(userLatitude) || !Number.isFinite(userLongitude)) return
    const target = regionAroundPoint(userLatitude!, userLongitude!, NEARBY_RADIUS_KM)
    setLiveUserCoords(null)
    setSelectedId(null)
    setViewRegion(target)
    fitNewAreaUntilRef.current = Date.now() + FIT_NEW_AREA_MS
    programmaticCameraUntilRef.current = Date.now() + 900
    // The location sheet is still closing; moving under it can get dropped.
    const timer = setTimeout(() => mapRef.current?.animateToRegion(target, 450), 320)
    return () => clearTimeout(timer)
  }, [visible, userLatitude, userLongitude])

  // The new area's pins arrive just after the move: frame them once they're here.
  useEffect(() => {
    if (!visible || areaMappable.length === 0 || Date.now() > fitNewAreaUntilRef.current) return
    setSelectedId((current) => current ?? areaMappable[0]?.id ?? null)
    programmaticCameraUntilRef.current = Date.now() + 900
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        areaMappable.map((item) => ({ latitude: item.latitude, longitude: item.longitude })),
        {
          edgePadding: { top: insets.top + 132, right: 40, bottom: CARD_HEIGHT + 64, left: 40 },
          animated: true,
        },
      )
    }, 340)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, areaMappable])

  function scrollCarouselToIndex(index: number, animated: boolean) {
    if (index < 0) return
    ignoreScrollUntilRef.current = Date.now() + (animated ? 500 : 250)
    const x = index * SNAP_INTERVAL
    const run = () =>
      carouselRef.current?.scrollTo({
        x,
        animated,
      })
    // Wait until the card press releases the ScrollView, otherwise iOS/Android
    // apply the offset immediately and the strip looks like it swapped.
    if (animated) {
      setTimeout(run, 32)
      return
    }
    run()
  }

  useEffect(() => {
    if (!visible || !showCarousel || selectedCarouselIndex < 0) return
    // A tap/pin press already started an animated scroll. Don't snap over it.
    if (Date.now() < ignoreScrollUntilRef.current) return
    scrollCarouselToIndex(selectedCarouselIndex, true)
  }, [visible, showCarousel, selectedId, selectedCarouselIndex])

  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [visible, onClose])

  function syncSelectionToRegion(region: Region) {
    if (dismissedRef.current) return
    const visible = pinsInRegion(mappableRef.current, region)
    setSelectedId((current) => {
      if (current && visible.some((item) => item.id === current)) {
        return current
      }
      return visible[0]?.id ?? null
    })
  }

  function handleRegionChangeComplete(region: Region) {
    setViewRegion((current) => {
      if (current && isSameRegion(current, region)) return current
      return region
    })
    if (Date.now() < programmaticCameraUntilRef.current) return
    syncSelectionToRegion(region)
  }

  function animateToCoords(latitude: number, longitude: number) {
    mapRef.current?.animateToRegion(
      regionAroundPoint(latitude, longitude, NEARBY_RADIUS_KM * 0.45),
      350,
    )
  }

  /** Back to where the phone is: the map moves first, then Home's location follows. */
  async function goToMyLocation() {
    if (locating) return
    setLocating(true)
    setLocateMessage(null)
    try {
      const result = await getDeviceCoordinatesDetailed({ promptIfNeeded: true })
      if (!result.ok) {
        setLocateMessage(
          result.reason === "permission_denied"
            ? "Allow location access in your phone settings to use this."
            : result.reason === "services_off"
              ? "Turn on location in your phone settings to use this."
              : "Couldn't find your location. Try again in a moment.",
        )
        return
      }
      const { latitude, longitude } = result.coords
      const target = regionAroundPoint(latitude, longitude, NEARBY_RADIUS_KM * 0.45)
      setLiveUserCoords(result.coords)
      setViewRegion(target)
      programmaticCameraUntilRef.current = Date.now() + 900
      mapRef.current?.animateToRegion(target, 350)
      onUseCoords(result.coords)
    } catch {
      setLocateMessage("Couldn't find your location. Try again in a moment.")
    } finally {
      setLocating(false)
    }
  }

  function focusPin(pinId: string, animateMap = true) {
    setDismissed(false)
    setSelectedId(pinId)
    const pin = mappable.find((item) => item.id === pinId)
    if (!pin) return

    const index = carouselItems.findIndex((item) => item.id === pinId)
    if (index >= 0) {
      scrollCarouselToIndex(index, true)
    }

    if (animateMap) {
      // Pan at the current zoom. Tightening zoom reshuffles visible cards and
      // can bounce selection between the first two listings.
      programmaticCameraUntilRef.current = Date.now() + 700
      mapRef.current?.animateToRegion(
        {
          latitude: pin.latitude,
          longitude: pin.longitude,
          latitudeDelta: activeRegion.latitudeDelta,
          longitudeDelta: activeRegion.longitudeDelta,
        },
        280,
      )
    }
  }

  /** Camera wandered away from every pin: bring them all back into view. */
  function showAllPins() {
    if (mappable.length === 0) return
    mapRef.current?.fitToCoordinates(
      mappable.map((item) => ({ latitude: item.latitude, longitude: item.longitude })),
      {
        edgePadding: { top: insets.top + 140, right: 48, bottom: CARD_HEIGHT + 96, left: 48 },
        animated: true,
      },
    )
  }

  function openPin(pin: MapPin) {
    if (pin.kind === "artist" && pin.artistSlug) {
      onSelectArtist?.(pin.artistSlug)
      return
    }
    if (pin.salonId) onSelectSalon(pin.salonId)
  }

  function onCarouselScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!carouselDragged.current) return
    carouselDragged.current = false
    if (Date.now() < ignoreScrollUntilRef.current) return
    const x = event.nativeEvent.contentOffset.x
    const index = Math.round(x / SNAP_INTERVAL)
    const pin = carouselItems[index]
    if (pin && pin.id !== selectedId) {
      focusPin(pin.id, true)
    }
  }

  if (!visible) return null

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.root}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={provider}
          customMapStyle={useCustomStyle ? GLAMMZO_MAP_STYLE : undefined}
          initialRegion={initialRegion}
          onMapReady={() => setMapReady(true)}
          onRegionChangeComplete={handleRegionChangeComplete}
          onPress={(event) => {
            // Tapping open map (not a pin) puts the card away, like the website map.
            if (event.nativeEvent.action === "marker-press") return
            if (selectedId) setDismissed(true)
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          showsPointsOfInterests={false}
          showsBuildings={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          mapPadding={{
            top: insets.top + 124,
            right: 0,
            bottom: bottomChrome,
            left: 0,
          }}
        >
          {hasUserMarker ? (
            <Marker
              coordinate={{
                latitude: markerLatitude!,
                longitude: markerLongitude!,
              }}
              identifier="user"
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.userDotOuter}>
                <View style={styles.userDotInner} />
              </View>
            </Marker>
          ) : null}

          {mapReady
            ? [...mappable]
                .sort((a, b) => {
                  if (a.id === selectedId) return 1
                  if (b.id === selectedId) return -1
                  return 0
                })
                .map((pin) => (
                  <MapPriceMarker
                    key={`${pin.id}-${pin.id === selectedId ? "on" : "off"}`}
                    pinId={pin.id}
                    label={pinLabel(pin)}
                    latitude={pin.latitude}
                    longitude={pin.longitude}
                    selected={pin.id === selectedId}
                    onPress={() => focusPin(pin.id, true)}
                  />
                ))
            : null}
        </MapView>

        <View
          style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
          pointerEvents="box-none"
        >
          <View style={styles.topRow} pointerEvents="box-none">
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.roundBtn, pressed && styles.pressedSoft]}
              accessibilityRole="button"
              accessibilityLabel="Back to list"
            >
              <Icon name="chevron-back" size={22} color={INK} />
            </Pressable>
            <Pressable
              onPress={onChangeLocation}
              style={({ pressed }) => [styles.searchPill, pressed && styles.pressedSoft]}
              accessibilityRole="search"
              accessibilityLabel={`Change location. ${summaryTitle(kindFilter, locationLabel)}, ${placeCount} ${placeCount === 1 ? "place" : "places"} in view`}
            >
              <Icon name="search" size={18} color={INK} />
              <View style={styles.searchCopy}>
                <RNText style={styles.searchTitle} numberOfLines={1}>
                  {summaryTitle(kindFilter, locationLabel)}
                </RNText>
                <RNText style={styles.searchSub} numberOfLines={1}>
                  {finding
                    ? "Looking around here"
                    : `${placeCount} ${placeCount === 1 ? "place" : "places"} in view · Change area`}
                </RNText>
              </View>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
            style={styles.filtersScroll}
            accessibilityRole="tablist"
            keyboardShouldPersistTaps="handled"
          >
            {KIND_FILTERS.map((item) => {
              const on = kindFilter === item.id
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setKindFilter(item.id)}
                  style={[styles.filterChip, on && styles.filterChipOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <RNText style={[styles.filterText, on && styles.filterTextOn]}>{item.label}</RNText>
                </Pressable>
              )
            })}
          </ScrollView>
          {finding ? (
            <View style={styles.findingPill} accessibilityLiveRegion="polite" pointerEvents="none">
              <ActivityIndicator size="small" color={INK} />
              <RNText style={styles.findingText}>Finding places…</RNText>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={goToMyLocation}
          style={({ pressed }) => [
            styles.roundBtn,
            styles.locateBtn,
            pressed && styles.pressedSoft,
            {
              bottom:
                (showCarousel
                  ? CARD_HEIGHT + spacing.xl
                  : emptyReady && !hasPlacesInView
                    ? 96 + spacing.md
                    : 44 + spacing.lg) + bottomInset,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go to my current location"
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color={INK} />
          ) : (
            <Icon name="locate" size={22} color={INK} />
          )}
        </Pressable>

        {locateMessage ? (
          <Pressable
            onPress={() => setLocateMessage(null)}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.locateMessage, { top: insets.top + 150 }]}
          >
            <Text variant="caption" color={colors.primaryFg}>
              {locateMessage}
            </Text>
          </Pressable>
        ) : null}

        {showCarousel ? (
          <View
            style={[styles.carouselWrap, { paddingBottom: bottomInset }]}
            pointerEvents="box-none"
          >
            <ScrollView
              ref={carouselRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={SNAP_INTERVAL}
              snapToAlignment="start"
              disableIntervalMomentum
              directionalLockEnabled
              contentOffset={{ x: Math.max(0, selectedCarouselIndex) * SNAP_INTERVAL, y: 0 }}
              onScrollBeginDrag={() => {
                carouselDragged.current = true
              }}
              onMomentumScrollEnd={onCarouselScrollEnd}
              contentContainerStyle={styles.carousel}
            >
              {carouselItems.map((pin) => (
                <View key={pin.id} style={styles.cardWrap}>
                  <MapListingCard pin={pin} onOpen={() => openPin(pin)} />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : showListPill ? (
          <View style={[styles.listPillWrap, { bottom: bottomInset + spacing.sm }]} pointerEvents="box-none">
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.listPill, pressed && styles.listPillPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Show list, ${placeCount} ${placeCount === 1 ? "place" : "places"}`}
            >
              <Icon name="list" size={16} color="#FFFFFF" />
              <RNText style={styles.listPillText}>{`Show list · ${placeCount}`}</RNText>
            </Pressable>
          </View>
        ) : emptyReady ? (
          <View
            style={[styles.emptyCardWrap, { paddingBottom: bottomInset }]}
            pointerEvents="box-none"
          >
            <View style={styles.emptyCard} accessibilityLiveRegion="polite">
              <View style={styles.emptyCopy}>
                <RNText style={styles.emptyTitle}>
                  {areaMappable.length > 0
                    ? "Nothing here, try zooming out"
                    : `No ${kindFilter === "salon" ? "salons" : kindFilter === "artist" ? "artists" : kindFilter === "home" ? "at-home artists" : "salons or artists"} in ${locationLabel}`}
                </RNText>
                <RNText style={styles.emptySub}>
                  {areaMappable.length > 0
                    ? "Or see every place on the map."
                    : kindFilter !== "all"
                      ? "See everything here, or try another area."
                      : "Try a nearby area."}
                </RNText>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={
                  areaMappable.length > 0
                    ? showAllPins
                    : kindFilter !== "all"
                      ? () => setKindFilter("all")
                      : onChangeLocation
                }
                hitSlop={8}
                style={styles.emptyAction}
              >
                <RNText style={styles.emptyActionText}>
                  {areaMappable.length > 0 || kindFilter !== "all" ? "Show all" : "Change"}
                </RNText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const INK = "#111111"
const INK_MUTED = "#595959"
const CHIP_BORDER = "#e3e3e3"

const floating = {
  shadowColor: "#000",
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 5,
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
  },
  root: {
    flex: 1,
    backgroundColor: colors.muted,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    ...floating,
  },
  pressedSoft: {
    backgroundColor: "#F4F4F4",
  },
  searchPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 52,
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFF",
    ...floating,
  },
  searchCopy: {
    flex: 1,
    minWidth: 0,
  },
  searchTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: INK,
  },
  searchSub: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: INK_MUTED,
  },
  filtersScroll: {
    flexGrow: 0,
    overflow: "visible",
  },
  filters: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: 6,
  },
  filterChip: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filterChipOn: {
    backgroundColor: INK,
    borderColor: INK,
  },
  filterText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: INK,
  },
  filterTextOn: {
    color: "#FFFFFF",
  },
  findingPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFF",
    ...floating,
  },
  findingText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: INK,
  },
  locateMessage: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 5,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: INK,
  },
  locateBtn: {
    position: "absolute",
    right: spacing.lg,
    zIndex: 4,
  },
  pricePin: {
    backgroundColor: "#FFFFFF",
    borderRadius: radii.pill,
    paddingHorizontal: Platform.OS === "android" ? 10 : 12,
    paddingVertical: Platform.OS === "android" ? 0 : 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: Platform.OS === "android" ? 0 : 4,
  },
  pricePinSelected: {
    backgroundColor: INK,
    borderColor: INK,
    paddingHorizontal: Platform.OS === "android" ? 12 : 14,
    paddingVertical: Platform.OS === "android" ? 0 : 8,
  },
  pricePinText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
  },
  pricePinTextSelected: {
    fontSize: 14,
  },
  pricePinTextAndroid: {
    includeFontPadding: false,
    textAlignVertical: "center",
    textAlign: "center",
  },
  userDotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(37, 99, 235, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  userDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  carouselWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    overflow: "visible",
  },
  carousel: {
    paddingHorizontal: SIDE_PAD,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: "stretch",
    overflow: "visible",
  },
  cardWrap: {
    width: CARD_WIDTH,
    marginRight: CARD_GAP,
  },
  listingCard: {
    height: CARD_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    ...floating,
  },
  listingCardPressed: {
    opacity: 0.9,
  },
  listingImage: {
    width: CARD_PHOTO,
    height: CARD_PHOTO,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#f2f2f2",
  },
  listingBody: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  listingNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  listingName: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: INK,
  },
  ratingPill: {
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
  listingMeta: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: INK_MUTED,
  },
  listingPrice: {
    marginTop: 4,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: INK,
  },
  listPillWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 4,
    alignItems: "center",
  },
  listPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: INK,
    ...floating,
  },
  listPillPressed: {
    backgroundColor: "#2B2B2B",
  },
  listPillText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: "#FFFFFF",
  },
  emptyCardWrap: {
    position: "absolute",
    left: SIDE_PAD,
    right: SIDE_PAD,
    bottom: 0,
    zIndex: 4,
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    ...floating,
  },
  emptyCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  emptyTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: INK,
  },
  emptySub: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: INK_MUTED,
  },
  emptyAction: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: INK,
  },
  emptyActionText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: "#FFFFFF",
  },
})
