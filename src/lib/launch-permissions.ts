import * as Notifications from "expo-notifications"

import {
  ensureForegroundLocationPermission,
  getDeviceCoordinates,
  resolvePlaceFromCoordinates,
} from "@/lib/device-location"
import { haversineKm } from "@/lib/geo"
import { ensureAndroidChannel, registerPushTokenWithServer } from "@/lib/push"
import {
  DEFAULT_SAVED_LOCATION,
  getSavedLocation,
  setSavedLocation,
  type SavedLocation,
} from "@/lib/user"

/** Shared in-flight work so concurrent callers await the same GPS resolve. */
let bootstrapPromise: Promise<SavedLocation> | null = null
/** The launch location alone, without waiting for the notification prompt after it. */
let launchLocationPromise: Promise<SavedLocation> | null = null
let locationPromise: Promise<SavedLocation> | null = null
let lastGpsAt = 0
let lastResolved: SavedLocation | null = null

const GPS_REFRESH_MS = 45_000
/** Within this distance of the saved place, launch keeps its name instead of geocoding again. */
const SAME_PLACE_KM = 0.5

type LocationListener = (location: SavedLocation) => void
const listeners = new Set<LocationListener>()

/**
 * True after the user picks a place in-app this process.
 * Cleared on cold start (module reload) so the next launch uses GPS again.
 */
let sessionManualLocation = false

/** Call when the user manually chooses a browse location. */
export function markSessionLocationManual() {
  sessionManualLocation = true
}

export function wasSessionLocationManual() {
  return sessionManualLocation
}

export function subscribeLaunchLocation(listener: LocationListener) {
  listeners.add(listener)
  if (lastResolved) listener(lastResolved)
  return () => {
    listeners.delete(listener)
  }
}

function emitLaunchLocation(location: SavedLocation) {
  lastResolved = location
  for (const listener of listeners) listener(location)
}

/** Previous deny fallback — treat as replaceable, not a user pick. */
function isLegacyDefaultLocation(location: SavedLocation) {
  return (
    location.area === "Koramangala" &&
    location.city === "Bengaluru" &&
    location.latitude === 12.9352 &&
    location.longitude === 77.6245
  )
}

async function deniedOrUnavailableLocation(
  existing: SavedLocation | null,
): Promise<SavedLocation> {
  const fallback =
    !existing || isLegacyDefaultLocation(existing)
      ? DEFAULT_SAVED_LOCATION
      : existing
  if (!existing || isLegacyDefaultLocation(existing)) {
    await setSavedLocation(fallback)
  }
  lastGpsAt = Date.now()
  emitLaunchLocation(fallback)
  return fallback
}

/**
 * Ask once if the OS has never prompted. Denied/restricted is not asked again.
 * Android still reports canAskAgain after the first Deny — do not use that flag.
 */
async function hasForegroundLocationAccess(): Promise<boolean> {
  return ensureForegroundLocationPermission(true)
}

/**
 * On first app session: ask for location + notification permission.
 * Allowed location → current place. Denied/failed → Indiranagar, Bengaluru.
 * Concurrent callers share one promise (avoids returning stale location mid-resolve).
 *
 * Manual picks during the session are not overwritten by this bootstrap.
 */
export async function bootstrapLaunchPermissions(): Promise<SavedLocation> {
  if (!bootstrapPromise) {
    launchLocationPromise = resolveLaunchLocation()
    bootstrapPromise = launchLocationPromise.then(async (location) => {
      await requestLaunchNotifications()
      return location
    })
  }
  return bootstrapPromise
}

/**
 * The first-launch location, for Home. Resolves as soon as the place is known:
 * Home does not wait for the notification prompt or push registration that follow.
 */
export async function bootstrapLaunchLocation(): Promise<SavedLocation> {
  void bootstrapLaunchPermissions()
  return launchLocationPromise ?? bootstrapLaunchPermissions()
}

/**
 * Re-read GPS after returning to the app, unless the user picked a place
 * this session. Throttled so tab switches don't hammer the radio.
 */
export async function refreshLaunchLocation(): Promise<SavedLocation> {
  if (sessionManualLocation) {
    const existing = await getSavedLocation()
    if (existing) {
      emitLaunchLocation(existing)
      return existing
    }
  }

  if (locationPromise) return locationPromise

  if (lastResolved && Date.now() - lastGpsAt < GPS_REFRESH_MS) {
    return lastResolved
  }

  return resolveLaunchLocation()
}

async function resolveLaunchLocation(): Promise<SavedLocation> {
  if (locationPromise) return locationPromise
  locationPromise = resolveLaunchLocationInner().finally(() => {
    locationPromise = null
  })
  return locationPromise
}

async function resolveLaunchLocationInner(): Promise<SavedLocation> {
  const existing = await getSavedLocation()

  // User already chose a place this session — don't fight them with GPS.
  if (sessionManualLocation && existing) {
    emitLaunchLocation(existing)
    return existing
  }

  try {
    const granted = await hasForegroundLocationAccess()
    if (!granted) {
      return deniedOrUnavailableLocation(existing)
    }

    const coords = await getDeviceCoordinates({ promptIfNeeded: false, preferLastKnown: true })
    if (!coords) {
      return deniedOrUnavailableLocation(existing)
    }
    lastGpsAt = Date.now()

    // Manual pick may have landed while GPS was resolving.
    if (sessionManualLocation) {
      const manual = await getSavedLocation()
      if (manual) {
        emitLaunchLocation(manual)
        return manual
      }
    }

    // Same spot as last time: keep the saved name and skip the reverse-geocode round trip.
    if (
      existing &&
      existing.scope !== "city" &&
      !isLegacyDefaultLocation(existing) &&
      existing.latitude != null &&
      existing.longitude != null &&
      haversineKm(existing.latitude, existing.longitude, coords.latitude, coords.longitude) <=
        SAME_PLACE_KM
    ) {
      emitLaunchLocation(existing)
      return existing
    }

    const place = await resolvePlaceFromCoordinates(coords)
    if (sessionManualLocation) {
      const manual = await getSavedLocation()
      if (manual) {
        emitLaunchLocation(manual)
        return manual
      }
    }
    const next: SavedLocation = {
      label: place.label,
      placeId: place.placeId || undefined,
      latitude: place.latitude,
      longitude: place.longitude,
      city: place.city,
      area: place.area,
      state: place.state,
      formattedAddress: place.formattedAddress,
    }
    await setSavedLocation(next)
    emitLaunchLocation(next)
    return next
  } catch {
    return deniedOrUnavailableLocation(existing)
  }
}

async function requestLaunchNotifications() {
  try {
    await ensureAndroidChannel()
    const { status: existing } = await Notifications.getPermissionsAsync()
    if (existing !== "granted") {
      await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      })
    }
    // Best-effort token register when already signed in.
    await registerPushTokenWithServer()
  } catch {
    // Permission prompts can fail on simulators / restricted devices.
  }
}
