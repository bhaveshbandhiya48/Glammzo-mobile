import { formatRupees } from "@/lib/service-pricing"
import Constants from "expo-constants"
import { Image } from "expo-image"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  BackHandler,
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

/** Airbnb-style compact listing strip */
const CARD_WIDTH = 300
const CARD_GAP = spacing.sm
const CARD_HEIGHT = 112
const SIDE_PAD = spacing.lg
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP
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
  onSelectSalon: (salonId: string) => void
  onSelectArtist?: (slug: string) => void
}

type MapPin = {
  id: string
  kind: "salon" | "artist"
  latitude: number
  longitude: number
  price: number
  name: string
  areaLine: string
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
    areaLine: [salon.area, salon.businessType].filter(Boolean).join(" · "),
    rating: salon.rating > 0 ? salon.rating : null,
    distanceKm: salon.distanceKm > 0 ? salon.distanceKm : null,
    imageUrl: salon.imageUrl || null,
    salonId: salon.id,
  }
}

function artistToPin(artist: ArtistCardData): MapPin | null {
  const coords = artistCoords(artist)
  if (!coords) return null
  const place = [artist.area, artist.hasStudio ? "Salon" : artist.offersHomeVisits ? "Home" : null]
    .filter(Boolean)
    .join(" · ")
  return {
    id: `artist:${artist.slug}`,
    kind: "artist",
    ...coords,
    price: artist.startingPrice ?? 0,
    name: artist.displayName,
    areaLine: place || "Solo artist",
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

function pricePinMinWidth(label: string) {
  // Android Google Maps snapshots custom markers into a bitmap and often
  // under-measures RN views, which clips multi-digit prices mid-glyph.
  // Extra space for the salon/artist icon before the price.
  const iconPad = Platform.OS === "android" ? 18 : 16
  const charWidth = Platform.OS === "android" ? 12 : 8.5
  const horizontalPad = Platform.OS === "android" ? 40 : 24
  const floor = Platform.OS === "android" ? 104 : 70
  return Math.max(floor, Math.ceil(horizontalPad + iconPad + label.length * charWidth))
}

/** Fixed Android height: pill + diamond caret (border triangles measure as 0×0). */
const ANDROID_PIN_HEIGHT = 52

function PricePin({
  price,
  kind,
  selected,
}: {
  price: number
  kind: MapPin["kind"]
  selected: boolean
}) {
  const label = `${formatRupees(Number(price) || 0)}`
  const width = pricePinMinWidth(label)
  const iconColor = selected ? colors.primaryFg : colors.text

  return (
    <View
      style={[
        styles.pinWrap,
        Platform.OS === "android"
          ? { width, height: ANDROID_PIN_HEIGHT }
          : { minWidth: width },
      ]}
      collapsable={false}
      renderToHardwareTextureAndroid
    >
      <View
        style={[
          styles.pricePin,
          Platform.OS === "android" ? { width, height: 36 } : { minWidth: width },
          selected && styles.pricePinSelected,
        ]}
        collapsable={false}
      >
        <Icon
          name={kind === "artist" ? "sparkles-outline" : "storefront-outline"}
          size={13}
          color={iconColor}
        />
        <RNText
          numberOfLines={1}
          allowFontScaling={false}
          style={[
            styles.pricePinText,
            Platform.OS === "android" && styles.pricePinTextAndroid,
            { color: iconColor },
          ]}
        >
          {label}
        </RNText>
      </View>
      {/* Real 10×10 view — Android bitmap capture often drops border-triangle carets. */}
      <View
        style={[styles.pinCaretDiamond, selected && styles.pinCaretDiamondSelected]}
        collapsable={false}
      />
    </View>
  )
}

/** Remounts + tracks redraw so selected coral pins don’t snapshot blank. */
function MapPriceMarker({
  pinId,
  kind,
  price,
  latitude,
  longitude,
  selected,
  onPress,
}: {
  pinId: string
  kind: MapPin["kind"]
  price: number
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
  }, [selected, price, pinId, kind])

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
      anchor={{ x: 0.5, y: 1 }}
      {...(Platform.OS === "android"
        ? {
            style: {
              width: pricePinMinWidth(`${formatRupees(Number(price) || 0)}`),
              height: ANDROID_PIN_HEIGHT,
              overflow: "visible" as const,
            },
          }
        : null)}
    >
      <PricePin price={price} kind={kind} selected={selected} />
    </Marker>
  )
}

function MapListingCard({
  pin,
  active,
  onOpen,
  onFocus,
}: {
  pin: MapPin
  active: boolean
  onOpen: () => void
  onFocus: () => void
}) {
  const distanceLabel =
    pin.distanceKm != null
      ? pin.distanceKm < 10
        ? `${pin.distanceKm.toFixed(1)} km`
        : `${Math.round(pin.distanceKm)} km`
      : null

  return (
    <Pressable
      onPress={onFocus}
      onLongPress={onOpen}
      style={[styles.listingCard, active && styles.listingCardActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {pin.imageUrl ? (
        <Image source={{ uri: pin.imageUrl }} style={styles.listingImage} contentFit="cover" />
      ) : (
        <View style={[styles.listingImage, styles.listingImageFallback]}>
          <Text variant="heading" color={colors.primaryFg}>
            {pin.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.listingBody}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {pin.name}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {pin.kind === "artist" ? "Solo artist · " : ""}
          {pin.areaLine}
        </Text>
        <View style={styles.listingMeta}>
          {pin.rating != null ? (
            <View style={styles.ratingChip}>
              <Text variant="caption" color={colors.primaryFg}>
                ★ {pin.rating.toFixed(1)}
              </Text>
            </View>
          ) : null}
          {distanceLabel ? (
            <Text variant="caption" muted>
              {distanceLabel}
            </Text>
          ) : null}
        </View>
        <View style={styles.listingFooter}>
          <Text variant="bodyStrong">
            {pin.price > 0 ? `${formatRupees(pin.price)}` : "—"}
          </Text>
          <Pressable accessibilityRole="button" onPress={onOpen} hitSlop={8} style={styles.viewBtn}>
            <Text variant="caption" color={colors.primary}>
              View
            </Text>
          </Pressable>
        </View>
      </View>
      {active ? (
        <View style={styles.listingCardActiveRing} pointerEvents="none" />
      ) : null}
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
  onSelectSalon,
  onSelectArtist,
}: Props) {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView | null>(null)
  const carouselRef = useRef<ScrollViewInstance | null>(null)
  const programmaticCameraUntilRef = useRef(0)
  const ignoreScrollUntilRef = useRef(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSalons, setShowSalons] = useState(true)
  const [showArtists, setShowArtists] = useState(true)
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
      setShowSalons(true)
      setShowArtists(true)
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
    const topPad = insets.top + 72
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
            top: insets.top + 56,
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
                    kind={pin.kind}
                    price={pin.price}
                    latitude={pin.latitude}
                    longitude={pin.longitude}
                    selected={pin.id === selectedId}
                    onPress={() => focusPin(pin.id, true)}
                  />
                ))
            : null}
        </MapView>

        {mappable.length === 0 ? (
          <View style={styles.emptyMap} pointerEvents="none">
            <Icon name="location-outline" size={22} color={colors.textMuted} />
            <Text muted style={{ marginTop: spacing.sm, textAlign: "center" }}>
              {!showSalons && showArtists
                ? "No mapped solo artists for this location yet."
                : showSalons && !showArtists
                  ? "No mapped salons for this location yet."
                  : "No mapped salons or artists for this location yet. Try browsing the city or another area."}
            </Text>
          </View>
        ) : null}

        <View
          style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={onClose}
            style={styles.listBtn}
            accessibilityRole="button"
            accessibilityLabel="Show list"
          >
            <Icon name="list-outline" size={18} color={colors.text} />
            <Text variant="caption">List</Text>
          </Pressable>

          <View style={styles.locationChip}>
            <Icon name="location" size={14} color={colors.primary} />
            <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
              {locationLabel}
              {carouselItems.length > 0 ? ` · ${carouselItems.length}` : ""}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close map"
          >
            <Icon name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View
          style={[
            styles.kindToggle,
            { top: insets.top + spacing.sm + 44 + spacing.sm },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => {
              // Keep at least one kind visible.
              if (showSalons && !showArtists) return
              setShowSalons((v) => !v)
            }}
            style={[styles.kindToggleBtn, showSalons && styles.kindToggleBtnOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: showSalons }}
            accessibilityLabel={showSalons ? "Hide salons" : "Show salons"}
          >
            <Icon
              name="storefront-outline"
              size={16}
              color={showSalons ? "#FFFFFF" : colors.textMuted}
            />
          </Pressable>
          <Pressable
            onPress={() => {
              if (showArtists && !showSalons) return
              setShowArtists((v) => !v)
            }}
            style={[styles.kindToggleBtn, showArtists && styles.kindToggleBtnOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: showArtists }}
            accessibilityLabel={showArtists ? "Hide solo artists" : "Show solo artists"}
          >
            <Icon
              name="sparkles-outline"
              size={16}
              color={showArtists ? "#FFFFFF" : colors.textMuted}
            />
          </Pressable>
        </View>

        <Pressable
          onPress={goToMyLocation}
          style={[
            styles.locateBtn,
            {
              bottom:
                (showCarousel ? CARD_HEIGHT + spacing.lg : spacing.xxl) +
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
              {carouselItems.map((pin) => {
                const active = pin.id === selectedId
                return (
                  <View key={pin.id} style={styles.cardWrap}>
                    <MapListingCard
                      pin={pin}
                      active={active}
                      onFocus={() => focusPin(pin.id, true)}
                      onOpen={() => openPin(pin)}
                    />
                  </View>
                )
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
  },
  root: {
    flex: 1,
    backgroundColor: "#EDE8E0",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  listBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.chrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  locationChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.chrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  locateBtn: {
    position: "absolute",
    right: spacing.lg,
    zIndex: 4,
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pinWrap: {
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "visible",
  },
  pricePin: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: radii.pill,
    paddingHorizontal: Platform.OS === "android" ? 12 : 10,
    paddingVertical: Platform.OS === "android" ? 0 : 8,
    minHeight: Platform.OS === "android" ? undefined : 34,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: Platform.OS === "android" ? 0 : 4,
    overflow: "visible",
  },
  kindToggle: {
    position: "absolute",
    right: spacing.lg,
    zIndex: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.chrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  kindToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  kindToggleBtnOn: {
    backgroundColor: "#111111",
  },
  pricePinSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pricePinText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  pricePinTextAndroid: {
    includeFontPadding: false,
    textAlignVertical: "center",
    textAlign: "center",
  },
  pinCaretDiamond: {
    width: 10,
    height: 10,
    marginTop: -5,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
  },
  pinCaretDiamondSelected: {
    backgroundColor: colors.primary,
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
  emptyMap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    backgroundColor: "rgba(245, 242, 236, 0.55)",
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
    backgroundColor: "#FFFFFF",
    borderRadius: radii.lg,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  listingCardActive: {
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  listingCardActiveRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  listingImage: {
    width: 112,
    height: "100%",
    backgroundColor: colors.muted,
  },
  listingImageFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#BDBDBD",
  },
  listingBody: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: "center",
    gap: 3,
    minWidth: 0,
  },
  listingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
  ratingChip: {
    backgroundColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  listingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  viewBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
})
