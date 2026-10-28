import { useEffect, useRef, useState, type RefObject } from "react"
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import {
  getDeviceCoordinates,
  resolvePlaceFromCoordinates,
} from "@/lib/device-location"
import { colors, radii, shadows, spacing } from "@/theme/tokens"

type MapViewRef = import("react-native-maps").default
type Region = {
  latitude: number
  longitude: number
  latitudeDelta: number
  longitudeDelta: number
}

export type HomeVisitPin = {
  lat: number
  lng: number
  address: string
  label: string
}

type Props = {
  /** Prefill when reopening. */
  latitude?: number | null
  longitude?: number | null
  address?: string
  onChange: (pin: HomeVisitPin) => void
}

// react-native-maps has no web build — same pattern as glamzzo-crm-mobile.
const Maps: typeof import("react-native-maps") | null =
  Platform.OS === "web" ? null : require("react-native-maps")

const INDIA: Region = {
  latitude: 22.5,
  longitude: 79,
  latitudeDelta: 22,
  longitudeDelta: 22,
}
const CLOSE_DELTA = 0.006

/**
 * Home-visit pin picker — mirrors glamzzo-crm-mobile LocationPicker:
 * default platform maps (Apple on iOS), fixed center pin, inline + fullscreen.
 */
export function HomeVisitMapPicker({
  latitude,
  longitude,
  address,
  onChange,
}: Props) {
  const [fullscreen, setFullscreen] = useState(false)
  const [panning, setPanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const mapRef = useRef<MapViewRef | null>(null)
  const fullMapRef = useRef<MapViewRef | null>(null)
  const skipRegionCommit = useRef(false)
  const syncFromMap = useRef(false)
  const userGesture = useRef(false)
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pinRef = useRef({ latitude, longitude, address })
  pinRef.current = { latitude, longitude, address }

  const hasPin = latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
  const pinRegion: Region = hasPin
    ? {
        latitude: latitude!,
        longitude: longitude!,
        latitudeDelta: CLOSE_DELTA,
        longitudeDelta: CLOSE_DELTA,
      }
    : INDIA

  useEffect(() => {
    return () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!hasPin) return
    if (syncFromMap.current) {
      syncFromMap.current = false
      return
    }
    const region: Region = {
      latitude: latitude!,
      longitude: longitude!,
      latitudeDelta: CLOSE_DELTA,
      longitudeDelta: CLOSE_DELTA,
    }
    skipRegionCommit.current = true
    mapRef.current?.animateToRegion(region, 350)
    fullMapRef.current?.animateToRegion(region, 350)
  }, [hasPin, latitude, longitude])

  function commitPin(lat: number, lng: number, nextAddress: string, label: string) {
    syncFromMap.current = true
    onChange({ lat, lng, address: nextAddress, label })
  }

  function reverseForPin(lat: number, lng: number) {
    if (reverseTimer.current) clearTimeout(reverseTimer.current)
    setBusy(true)
    setNotice(null)
    reverseTimer.current = setTimeout(() => {
      void resolvePlaceFromCoordinates({ latitude: lat, longitude: lng })
        .then((place) => {
          commitPin(
            lat,
            lng,
            place.formattedAddress || place.label,
            place.label,
          )
        })
        .catch(() => {
          commitPin(lat, lng, pinRef.current.address || "Pinned location", "Pinned location")
          setNotice("Couldn't look up the street name — pin is still saved.")
        })
        .finally(() => setBusy(false))
    }, 280)
  }

  async function useCurrent() {
    setBusy(true)
    setNotice(null)
    try {
      const coords = await getDeviceCoordinates({
        promptIfNeeded: true,
        timeoutMs: 12_000,
      })
      if (!coords) {
        setNotice("Couldn't get your location. Allow access or drag the map.")
        return
      }
      onChange({
        lat: coords.latitude,
        lng: coords.longitude,
        address: pinRef.current.address || "",
        label: "Current location",
      })
      const place = await resolvePlaceFromCoordinates(coords)
      commitPin(
        coords.latitude,
        coords.longitude,
        place.formattedAddress || place.label,
        place.label,
      )
    } catch {
      setNotice("Couldn't get your location. Drag the map instead.")
    } finally {
      setBusy(false)
    }
  }

  const onRegionChangeComplete = (region: Region) => {
    setPanning(false)
    if (skipRegionCommit.current) {
      skipRegionCommit.current = false
      return
    }
    if (!userGesture.current && !hasPin) return
    userGesture.current = false

    const prev = pinRef.current
    const same =
      prev.latitude != null &&
      prev.longitude != null &&
      Math.abs(region.latitude - prev.latitude) < 0.00001 &&
      Math.abs(region.longitude - prev.longitude) < 0.00001
    if (same) return

    syncFromMap.current = true
    onChange({
      lat: region.latitude,
      lng: region.longitude,
      address: prev.address || "",
      label: "Pinned location",
    })
    reverseForPin(region.latitude, region.longitude)
  }

  const mapElement = (
    ref: RefObject<MapViewRef | null>,
    boxStyle: StyleProp<ViewStyle>,
    mode: "inline" | "full",
  ) => {
    if (!Maps) {
      return (
        <View style={[boxStyle, styles.mapFallback]}>
          <Text muted>Maps aren’t available on web.</Text>
        </View>
      )
    }
    return (
      <View style={boxStyle} collapsable={false}>
        <Maps.default
          ref={ref}
          style={StyleSheet.absoluteFill}
          initialRegion={pinRegion}
          onPanDrag={() => {
            userGesture.current = true
            setPanning(true)
          }}
          onRegionChangeComplete={onRegionChangeComplete}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          showsUserLocation
          showsMyLocationButton={false}
          moveOnMarkerPress={false}
        />

        <View style={[styles.pinAnchor, styles.peNone]}>
          <View style={[styles.pinGraphic, panning && styles.pinLifted]}>
            <View style={styles.pinHead}>
              <View style={styles.pinDot} />
            </View>
            <View style={styles.pinPoint} />
          </View>
          <View style={[styles.pinGround, panning && styles.pinGroundActive]} />
        </View>

        {!hasPin && mode === "inline" ? (
          <View style={[styles.mapHint, styles.peNone]}>
            <Text variant="caption" color={colors.primaryFg} style={styles.mapHintText}>
              Move the map to place the pin on your exact spot.
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.mapControls,
            mode === "full" && styles.mapControlsFull,
            styles.peBoxNone,
          ]}
        >
          <Pressable
            onPress={() => void useCurrent()}
            disabled={busy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Use my current location"
            style={({ pressed }) => [
              styles.mapFab,
              pressed && styles.mapFabPressed,
              busy && styles.mapFabBusy,
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon name="locate" size={20} color={colors.primary} />
            )}
          </Pressable>
          {mode === "inline" ? (
            <Pressable
              onPress={() => setFullscreen(true)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Open full screen map"
              style={({ pressed }) => [styles.mapFab, pressed && styles.mapFabPressed]}
            >
              <Icon name="resize-outline" size={18} color={colors.text} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setFullscreen(false)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Close full screen map"
              style={({ pressed }) => [styles.mapFab, pressed && styles.mapFabPressed]}
            >
              <Icon name="close" size={18} color={colors.text} />
            </Pressable>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <Text variant="caption" muted>
        Drag the map so the pin sits on your entrance. The artist uses this for
        directions.
      </Text>

      {mapElement(mapRef, styles.mapBox, "inline")}

      <Pressable
        onPress={() => void useCurrent()}
        disabled={busy}
        style={({ pressed }) => [styles.locateRow, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Icon name="locate" size={18} color={colors.primary} />
        )}
        <Text variant="bodyStrong" color={colors.primary}>
          Use my current location
        </Text>
      </Pressable>

      {hasPin ? (
        <Text variant="caption" muted numberOfLines={2}>
          Pin set
          {address?.trim() ? ` · ${address.trim()}` : ` · ${latitude!.toFixed(4)}, ${longitude!.toFixed(4)}`}
        </Text>
      ) : (
        <Text variant="caption" color={colors.destructive}>
          Add a map pin to continue with a home visit.
        </Text>
      )}

      {notice ? (
        <Text variant="caption" color={colors.destructive}>
          {notice}
        </Text>
      ) : null}

      <Modal
        visible={fullscreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setFullscreen(false)}
      >
        <SafeAreaView style={styles.fullSafe} edges={["top", "left", "right", "bottom"]}>
          {mapElement(fullMapRef, styles.fullMap, "full")}
          <View style={styles.fullFooter}>
            <Button
              label="Done"
              onPress={() => setFullscreen(false)}
              disabled={!hasPin}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  mapBox: {
    height: 240,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.muted,
  },
  mapFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  mapHint: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  mapHintText: {
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: radii.pill,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pinAnchor: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 0,
    height: 0,
    zIndex: 2,
  },
  pinGraphic: {
    position: "absolute",
    left: -14,
    bottom: 0,
    width: 28,
    alignItems: "center",
  },
  pinLifted: {
    bottom: 10,
  },
  pinHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    ...shadows.card,
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  pinPoint: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.primary,
  },
  pinGround: {
    position: "absolute",
    left: -5,
    top: -3,
    width: 10,
    height: 6,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  pinGroundActive: {
    left: -8,
    width: 16,
    height: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  mapControls: {
    position: "absolute",
    right: 12,
    bottom: 12,
    gap: 10,
    alignItems: "center",
    zIndex: 3,
  },
  mapControlsFull: {
    top: 12,
    bottom: undefined,
  },
  peNone: { pointerEvents: "none" },
  peBoxNone: { pointerEvents: "box-none" },
  mapFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    ...shadows.card,
  },
  mapFabPressed: { opacity: 0.88 },
  mapFabBusy: { opacity: 0.7 },
  locateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
  },
  fullSafe: { flex: 1, backgroundColor: colors.bg },
  fullMap: { flex: 1, backgroundColor: colors.muted },
  fullFooter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
})
