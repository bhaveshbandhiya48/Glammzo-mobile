import * as Location from "expo-location"

import { reverseGeocode, type ResolvedPlace } from "@/lib/location-api"

const GPS_TIMEOUT_MS = 8_000
const REVERSE_TIMEOUT_MS = 10_000
const NATIVE_REVERSE_TIMEOUT_MS = 5_000
const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** Prompt only if the OS has never asked. Denied stays denied. */
export async function ensureForegroundLocationPermission(
  promptIfNeeded: boolean,
): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync()
  if (current.granted) return true
  if (!promptIfNeeded) return false
  if (current.status !== Location.PermissionStatus.UNDETERMINED) return false
  const requested = await Location.requestForegroundPermissionsAsync()
  return requested.granted
}

/**
 * Fast coords for browse: last-known first, then a bounded GPS fix.
 * Does not show Android's "improve accuracy" settings dialog.
 */
export async function getDeviceCoordinates(options?: {
  promptIfNeeded?: boolean
  timeoutMs?: number
}): Promise<{ latitude: number; longitude: number } | null> {
  const granted = await ensureForegroundLocationPermission(
    options?.promptIfNeeded ?? false,
  )
  if (!granted) return null

  const timeoutMs = options?.timeoutMs ?? GPS_TIMEOUT_MS

  const recent = await Location.getLastKnownPositionAsync({
    maxAge: LAST_KNOWN_MAX_AGE_MS,
    requiredAccuracy: 1000,
  }).catch(() => null)

  try {
    const current = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: false,
      }),
      timeoutMs,
    )
    return {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    }
  } catch {
    if (recent) {
      return {
        latitude: recent.coords.latitude,
        longitude: recent.coords.longitude,
      }
    }
    const stale = await Location.getLastKnownPositionAsync().catch(() => null)
    if (!stale) return null
    return {
      latitude: stale.coords.latitude,
      longitude: stale.coords.longitude,
    }
  }
}

function placeFromNativeAddress(
  addr: Location.LocationGeocodedAddress,
  latitude: number,
  longitude: number,
): ResolvedPlace {
  const area =
    addr.district?.trim() ||
    addr.subregion?.trim() ||
    addr.name?.trim() ||
    ""
  const city = addr.city?.trim() || ""
  const state = addr.region?.trim() || ""
  const label =
    area && city && area.toLowerCase() !== city.toLowerCase()
      ? `${area}, ${city}`
      : area || city || "Current location"
  const formattedAddress =
    [addr.street, area, city, state].filter(Boolean).join(", ") || label

  return {
    placeId: "",
    label,
    formattedAddress,
    latitude,
    longitude,
    city: city || undefined,
    area: area || undefined,
    state: state || undefined,
  }
}

/** Server reverse geocode, then on-device, then a coords-only fallback. */
export async function resolvePlaceFromCoordinates(input: {
  latitude: number
  longitude: number
}): Promise<ResolvedPlace> {
  try {
    const place = await reverseGeocode(input, { timeoutMs: REVERSE_TIMEOUT_MS })
    if (place?.label?.trim()) return place
  } catch {
    // Network / Places quota — still try the device geocoder.
  }

  try {
    const results = await withTimeout(
      Location.reverseGeocodeAsync({
        latitude: input.latitude,
        longitude: input.longitude,
      }),
      NATIVE_REVERSE_TIMEOUT_MS,
    )
    const addr = results[0]
    if (addr) return placeFromNativeAddress(addr, input.latitude, input.longitude)
  } catch {
    // Keep GPS even if naming fails.
  }

  return {
    placeId: "",
    label: "Current location",
    formattedAddress: "Current location",
    latitude: input.latitude,
    longitude: input.longitude,
  }
}
