import { formatRupees } from "@/lib/service-pricing"
import Constants from "expo-constants"
import { Image } from "expo-image"
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

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Salon } from "@/data/types"
import type { ArtistCardData } from "@/lib/artists-api"
import { getDeviceCoordinates } from "@/lib/device-location"
import { NEARBY_RADIUS_KM } from "@/lib/explore-location"
import { GLAMMZO_MAP_STYLE } from "@/lib/map-styles"
import { colors, radii, spacing } from "@/theme/tokens"

/** One card at a time, with the next one peeking in. */
const SIDE_PAD = spacing.lg
const CARD_GAP = spacing.sm
const CARD_WIDTH = Dimensions.get("window").width - SIDE_PAD * 2 - spacing.xl
const CARD_HEIGHT = 104
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
  onSelectSalon: (salonId: string) => void
  onSelectArtist?: (slug: string) => void
}

type KindFilter = "all" | "salon" | "artist"

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "salon", label: "Salons" },
  { id: "artist", label: "Artists" },
]

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
    imageUrl: salon.imageUrl || null,
    salonId: salon.id,
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
    imageUrl: artist.profilePhotoUrl,
    artistSlug: artist.slug,
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

function pinLabel(pin: { price: number; name: string }) {
  const price = Number(pin.price) || 0
  if (price > 0) return formatRupees(price)
  // No price yet: the name says more than an empty pin.
  return pin.name.length > 12 ? `${pin.name.slice(0, 11).trim()}…` : pin.name
}

function pricePinMinWidth(label: string) {
  // Android Google Maps snapshots custom markers into a bitmap and often
  // under-measures RN views, which clips multi-digit prices mid-glyph.
  const charWidth = Platform.OS === "android" ? 11 : 8
  const horizontalPad = Platform.OS === "android" ? 32 : 24
  const floor = Platform.OS === "android" ? 72 : 56
  return Math.max(floor, Math.ceil(horizontalPad + label.length * charWidth))
}

/** Fixed Android height, with room for the bitmap capture. */
const ANDROID_PIN_HEIGHT = 36

function PricePin({ label, selected }: { label: string; selected: boolean }) {
  const width = pricePinMinWidth(label)

  return (
    <View
      style={[
        styles.pricePin,
        Platform.OS === "android" ? { width, height: ANDROID_PIN_HEIGHT } : { minWidth: width },
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
          { color: selected ? colors.primaryFg : colors.text },
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
              width: pricePinMinWidth(label),
              height: ANDROID_PIN_HEIGHT,
              overflow: "visible" as const,
            },
          }
        : null)}
    >
      <PricePin label={label} selected={selected} />
    </Marker>
  )
}

function MapListingCard({ pin, onOpen }: { pin: MapPin; onOpen: () => void }) {
  const distanceLabel =
    pin.distanceKm != null
      ? pin.distanceKm < 10
        ? `${pin.distanceKm.toFixed(1)} km`
        : `${Math.round(pin.distanceKm)} km`
      : null
  const kindLabel = pin.kind === "artist" ? "Artist" : "Salon"
  const placeLine = [kindLabel, pin.place, distanceLabel].filter(Boolean).join(" · ")
  const priceLabel = pin.price > 0 ? `from ${formatRupees(pin.price)}` : null

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.listingCard, pressed && styles.listingCardPressed]}
      accessibilityRole="button"
      accessibilityLabel={[
        pin.name,
        placeLine,
        pin.rating != null ? `${pin.rating.toFixed(1)} stars` : "New",
        priceLabel,
      ]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint="Opens the details"
    >
      {pin.imageUrl ? (
        <Image source={{ uri: pin.imageUrl }} style={styles.listingImage} contentFit="cover" />
      ) : (
        <View style={[styles.listingImage, styles.listingImageFallback]}>
          <Text variant="heading" muted>
            {pin.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.listingBody}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {pin.name}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {placeLine}
        </Text>
        <Text variant="caption" numberOfLines={1} style={styles.listingMeta}>
          {pin.rating != null ? `★ ${pin.rating.toFixed(1)}` : "New"}
          {priceLabel ? `  ·  ${priceLabel}` : ""}
        </Text>
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
  onSelectSalon,
  onSelectArtist,
}: Props) {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView | null>(null)
  const carouselRef = useRef<ScrollViewInstance | null>(null)
  const programmaticCameraUntilRef = useRef(0)
  const ignoreScrollUntilRef = useRef(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  const showSalons = kindFilter !== "artist"
  const showArtists = kindFilter !== "salon"
  const [viewRegion, setViewRegion] = useState<Region | null>(null)
  const [liveUserCoords, setLiveUserCoords] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [locating, setLocating] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const provider = useGoogleMapsProvider()
  const useCustomStyle = provider === PROVIDER_GOOGLE
  const mappableRef = useRef<MapPin[]>([])

  const mappable = useMemo(() => {
    const salonPins = showSalons
      ? salons.map(salonToPin).filter((item): item is MapPin => item != null)
      : []
    const artistPins = showArtists
      ? artists.map(artistToPin).filter((item): item is MapPin => item != null)
      : []
    return [...salonPins, ...artistPins]
  }, [salons, artists, showSalons, showArtists])
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

  const showCarousel = carouselItems.length > 0
  const placeCount = carouselItems.length
  // Pins arrive just after a move, so wait a moment before saying there are none.
  const [emptyReady, setEmptyReady] = useState(false)
  useEffect(() => {
    setEmptyReady(false)
    if (!visible || showCarousel) return
    const timer = setTimeout(() => setEmptyReady(true), 900)
    return () => clearTimeout(timer)
  }, [visible, showCarousel, locationLabel])

  const markerLatitude = liveUserCoords?.latitude ?? userLatitude
  const markerLongitude = liveUserCoords?.longitude ?? userLongitude
  const hasUserMarker =
    Number.isFinite(markerLatitude) && Number.isFinite(markerLongitude)
  const hasSavedUserCoords =
    Number.isFinite(userLatitude) && Number.isFinite(userLongitude)

  const bottomChrome =
    (showCarousel ? CARD_HEIGHT + spacing.xl : spacing.xxl) +
    Math.max(insets.bottom, spacing.md)

  useEffect(() => {
    if (!visible) {
      setSelectedId(null)
      setKindFilter("all")
      setViewRegion(null)
      setLiveUserCoords(null)
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
    const topPad = insets.top + 112
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
          edgePadding: { top: insets.top + 112, right: 40, bottom: CARD_HEIGHT + 64, left: 40 },
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

  async function goToMyLocation() {
    if (locating) return
    setLocating(true)
    try {
      const coords = await getDeviceCoordinates({ promptIfNeeded: true })
      if (coords) {
        setLiveUserCoords(coords)
        animateToCoords(coords.latitude, coords.longitude)
        return
      }
      if (hasSavedUserCoords) {
        animateToCoords(userLatitude!, userLongitude!)
      }
    } catch {
      if (hasSavedUserCoords) {
        animateToCoords(userLatitude!, userLongitude!)
      }
    } finally {
      setLocating(false)
    }
  }

  function focusPin(pinId: string, animateMap = true) {
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
        edgePadding: { top: insets.top + 120, right: 48, bottom: CARD_HEIGHT + 96, left: 48 },
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
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          showsPointsOfInterests={false}
          showsBuildings={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          mapPadding={{
            top: insets.top + 100,
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
              style={styles.roundBtn}
              accessibilityRole="button"
              accessibilityLabel="Back to list"
            >
              <Icon name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={onChangeLocation}
              style={({ pressed }) => [styles.locationChip, pressed && styles.locationChipPressed]}
              accessibilityRole="search"
              accessibilityLabel={`Change location. Now ${locationLabel}, ${placeCount} ${placeCount === 1 ? "place" : "places"} in view`}
            >
              <Icon name="search" size={18} color={colors.text} />
              <Text variant="bodyStrong" numberOfLines={1} style={styles.locationName}>
                {locationLabel}
              </Text>
              <Text variant="caption" muted>
                {placeCount} {placeCount === 1 ? "place" : "places"}
              </Text>
            </Pressable>
          </View>
          <View style={styles.filters} accessibilityRole="tablist">
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
                  <Text variant="caption" style={styles.filterText} color={on ? colors.primaryFg : colors.text}>
                    {item.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Pressable
          onPress={goToMyLocation}
          style={[
            styles.roundBtn,
            styles.locateBtn,
            {
              bottom:
                (showCarousel || mappable.length > 0 ? CARD_HEIGHT + spacing.xl : spacing.xxl) +
                Math.max(insets.bottom, spacing.md),
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go to my current location"
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Icon name="locate" size={22} color={colors.primary} />
          )}
        </Pressable>

        {showCarousel ? (
          <View
            style={[
              styles.carouselWrap,
              { paddingBottom: Math.max(insets.bottom, spacing.md) },
            ]}
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
        ) : emptyReady ? (
          <View
            style={[styles.emptyCardWrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
            pointerEvents="box-none"
          >
            <View style={styles.emptyCard} accessibilityLiveRegion="polite">
              <View style={styles.emptyCopy}>
                <Text variant="bodyStrong">
                  {areaMappable.length > 0
                    ? "Nothing in this part of the map"
                    : `No ${kindFilter === "salon" ? "salons" : kindFilter === "artist" ? "artists" : "salons or artists"} in ${locationLabel}`}
                </Text>
                <Text variant="caption" muted>
                  {areaMappable.length > 0
                    ? "Move the map or see every place."
                    : kindFilter !== "all"
                      ? "See everything here, or try another area."
                      : "Try a nearby area."}
                </Text>
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
                <Text variant="caption" style={styles.filterText} color={colors.primaryFg}>
                  {areaMappable.length > 0 || kindFilter !== "all" ? "Show all" : "Change"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const floating = {
  shadowColor: "#000",
  shadowOpacity: 0.1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
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
    paddingHorizontal: spacing.lg,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    ...floating,
  },
  locationChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...floating,
  },
  locationChipPressed: {
    backgroundColor: colors.muted,
  },
  locationName: {
    flex: 1,
  },
  filters: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  filterChip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...floating,
  },
  filterChipOn: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontFamily: "Geist_600SemiBold",
  },
  locateBtn: {
    position: "absolute",
    right: spacing.lg,
    zIndex: 4,
  },
  pricePin: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: Platform.OS === "android" ? 10 : 12,
    paddingVertical: Platform.OS === "android" ? 0 : 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.14)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: Platform.OS === "android" ? 0 : 4,
  },
  pricePinSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pricePinText: {
    fontSize: 13,
    fontFamily: "Geist_600SemiBold",
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
    borderColor: colors.surface,
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
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
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    ...floating,
  },
  listingCardPressed: {
    backgroundColor: colors.muted,
  },
  listingImage: {
    width: CARD_HEIGHT - spacing.sm * 2,
    height: CARD_HEIGHT - spacing.sm * 2,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
  },
  listingImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  listingBody: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  listingMeta: {
    marginTop: spacing.xs,
    fontFamily: "Geist_600SemiBold",
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
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...floating,
  },
  emptyCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  emptyAction: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
})
