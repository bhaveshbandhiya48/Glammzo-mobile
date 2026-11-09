import * as Location from "expo-location"
import { Linking, Platform } from "react-native"

import { reverseGeocode, type ResolvedPlace } from "@/lib/location-api"

const GPS_TIMEOUT_MS = 8_000
/** Right after location is switched on there's no cached fix, so the first one can take longer. */
const FRESH_GPS_TIMEOUT_MS = 15_000
/** Some Android phones report location as off for a moment after it's switched on. */
const SERVICES_SETTLE_MS = 3_000
const REVERSE_TIMEOUT_MS = 10_000
const NATIVE_REVERSE_TIMEOUT_MS = 5_000
const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000

export type DeviceLocationFailure =
  | "permission_denied"
  | "services_off"
  | "unavailable"

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

/** When prompting: ask if undetermined, or again if the OS still allows it. */
export async function ensureForegroundLocationPermission(
  promptIfNeeded: boolean,
): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync()
  if (current.granted) return true
  if (!promptIfNeeded) return false
  if (current.status === Location.PermissionStatus.DENIED && !current.canAskAgain) {
    return false
  }
  if (
    current.status !== Location.PermissionStatus.UNDETERMINED &&
    current.status !== Location.PermissionStatus.DENIED
  ) {
    return false
  }
  const requested = await Location.requestForegroundPermissionsAsync()
  return requested.granted
}

/**
 * On Android, show the system dialog to turn location / high-accuracy on.
 * No-op when services are already enabled. Returns whether services are on.
 */
async function servicesEnabled(): Promise<boolean> {
  return Location.hasServicesEnabledAsync().catch(() => true)
}

/** Polls until the phone reports location as on, for up to `ms`. */
async function waitForServices(ms: number): Promise<boolean> {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (await servicesEnabled()) return true
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return servicesEnabled()
}

export async function ensureLocationServicesEnabled(
  promptIfNeeded: boolean,
): Promise<boolean> {
  return (await ensureLocationServicesDetailed(promptIfNeeded)).on
}

/** `justEnabled`: location was off and the user turned it on from the system dialog just now. */
async function ensureLocationServicesDetailed(
  promptIfNeeded: boolean,
): Promise<{ on: boolean; justEnabled: boolean }> {
  if (await servicesEnabled()) return { on: true, justEnabled: false }
  if (!promptIfNeeded) return { on: false, justEnabled: false }

  if (Platform.OS === "android") {
    try {
      // Google Play services dialog: turn on location / high accuracy.
      // It resolves only when the user taps Turn on, so location is on even if the phone
      // hasn't reported it yet. Give it a moment instead of saying "turn on location" again.
      await Location.enableNetworkProviderAsync()
      await waitForServices(SERVICES_SETTLE_MS)
      return { on: true, justEnabled: true }
    } catch {
      // Dismissed, or no Play services dialog: the user may still have switched it on.
      return { on: await servicesEnabled(), justEnabled: false }
    }
  }

  // iOS: only the user can enable Location Services in Settings.
  return { on: false, justEnabled: false }
}

async function readCoordinates(options: {
  promptSettingsDialog: boolean
  timeoutMs: number
}): Promise<{ latitude: number; longitude: number } | null> {
  const recent = await Location.getLastKnownPositionAsync({
    maxAge: LAST_KNOWN_MAX_AGE_MS,
    requiredAccuracy: 1000,
  }).catch(() => null)

  try {
    const current = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        // Android: Play Services "turn on location" / improve accuracy dialog.
        mayShowUserSettingsDialog: options.promptSettingsDialog,
      }),
      options.timeoutMs,
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

/**
 * Fast coords for browse: last-known first, then a bounded GPS fix.
 * When `promptIfNeeded`, Android shows the turn-on-location system dialog if GPS is off.
 */
export async function getDeviceCoordinates(options?: {
  promptIfNeeded?: boolean
  timeoutMs?: number
}): Promise<{ latitude: number; longitude: number } | null> {
  const prompt = options?.promptIfNeeded ?? false
  const granted = await ensureForegroundLocationPermission(prompt)
  if (!granted) return null

  const services = prompt
    ? await ensureLocationServicesDetailed(true)
    : { on: true, justEnabled: false }

  return readCoordinates({
    promptSettingsDialog: prompt && !services.justEnabled,
    timeoutMs:
      options?.timeoutMs ?? (services.justEnabled ? FRESH_GPS_TIMEOUT_MS : GPS_TIMEOUT_MS),
  })
}

/** Richer result for UI that needs specific error copy (e.g. Use current location). */
export async function getDeviceCoordinatesDetailed(options?: {
  promptIfNeeded?: boolean
  timeoutMs?: number
}): Promise<
  | { ok: true; coords: { latitude: number; longitude: number } }
  | { ok: false; reason: DeviceLocationFailure }
> {
  const prompt = options?.promptIfNeeded ?? false
  const permission = await Location.getForegroundPermissionsAsync()
  const granted = await ensureForegroundLocationPermission(prompt)
  if (!granted) {
    if (prompt && permission.status === Location.PermissionStatus.DENIED && !permission.canAskAgain) {
      void Linking.openSettings()
    }
    return { ok: false, reason: "permission_denied" }
  }

  const services = await ensureLocationServicesDetailed(prompt)

  // Try for a fix even when the phone still says location is off: the "is it on" check can lag
  // behind the real setting, and a fix is the real proof. Only blame the setting if that fails.
  const coords = await readCoordinates({
    promptSettingsDialog: prompt && !services.justEnabled,
    timeoutMs:
      options?.timeoutMs ?? (services.justEnabled ? FRESH_GPS_TIMEOUT_MS : GPS_TIMEOUT_MS),
  })
  if (coords) return { ok: true, coords }
  if (!services.on && !(await servicesEnabled())) return { ok: false, reason: "services_off" }
  return { ok: false, reason: "unavailable" }
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
