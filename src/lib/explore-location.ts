import type { Salon } from "@/data/types"
import { filterSalonsByCity, normalizeCityName } from "@/lib/city-filter"
import { haversineKm } from "@/lib/geo"
import type { SavedLocation } from "@/lib/user"

/** Matches Glammzo-web DEFAULT_NEARBY_RADIUS_KM */
export const NEARBY_RADIUS_KM = 10

/** When fewer salons than this are within 10 km, look further out. */
export const WIDEN_MIN_RESULTS = 3
/** The next radius tried before falling back to the whole city. */
export const WIDE_RADIUS_KM = 25

/** Home shows this many salons per row; "See all" lists the rest. */
export const HOME_CAROUSEL_LIMIT = 10

export type LocationBrowseMode = "nearby" | "city"

export type LocationEmptyKind = "none" | "nearby_city_available" | "out_of_service"

export type ExploreLocationResult = {
  salons: Salon[]
  emptyKind: LocationEmptyKind
  cityLabel: string | null
  nearbyCount: number
  cityCount: number
  scopeLabel: string | null
  /** Radius used for this list, or null when it is the whole city or text matched. */
  radiusKm?: number | null
  /** True when the list reaches past 10 km because too few salons were closer. */
  widened?: boolean
}

function hasCoords(location: SavedLocation | null): location is SavedLocation & {
  latitude: number
  longitude: number
} {
  return (
    location != null &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  )
}

function sameName(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeCityName(a ?? "") || (a ?? "").trim().toLowerCase()
  const right = normalizeCityName(b ?? "") || (b ?? "").trim().toLowerCase()
  return left.length > 0 && left === right
}

/**
 * True when a place picked from search is a whole city ("Jamnagar"),
 * not an area or address inside one ("Patel Colony, Jamnagar").
 */
export function isCityLevelPlace(place: {
  label?: string
  city?: string
  area?: string
  formattedAddress?: string
}): boolean {
  if (!place.city?.trim()) return false
  // Google formats a city as "Jamnagar, Gujarat, India" and an address as
  // "Street, Area, Jamnagar, Gujarat 361001, India", so the first part tells them apart.
  const firstPart = place.formattedAddress?.split(",")[0]?.trim()
  if (firstPart) return sameName(firstPart, place.city)
  return !place.area?.trim() || sameName(place.area, place.city)
}

/** A whole-city pick lists the whole city; GPS or an address lists salons nearby. */
export function browseModeFor(location: SavedLocation | null): LocationBrowseMode {
  return location?.scope === "city" ? "city" : "nearby"
}

/** Same haversine distance Explore uses for list cards. */
export function withSalonDistanceFromLocation(
  salon: Salon,
  location: SavedLocation | null,
): Salon {
  if (
    !hasCoords(location) ||
    salon.latitude == null ||
    salon.longitude == null ||
    !Number.isFinite(salon.latitude) ||
    !Number.isFinite(salon.longitude)
  ) {
    return salon
  }
  return {
    ...salon,
    distanceKm: haversineKm(
      location.latitude,
      location.longitude,
      salon.latitude,
      salon.longitude,
    ),
  }
}

export function filterSalonsNearby(
  salons: Salon[],
  latitude: number,
  longitude: number,
  radiusKm = NEARBY_RADIUS_KM,
): Salon[] {
  const withDistance = salons
    .map((salon) => {
      if (
        salon.latitude == null ||
        salon.longitude == null ||
        !Number.isFinite(salon.latitude) ||
        !Number.isFinite(salon.longitude)
      ) {
        return null
      }
      const distanceKm = haversineKm(
        latitude,
        longitude,
        salon.latitude,
        salon.longitude,
      )
      if (distanceKm > radiusKm) return null
      return { ...salon, distanceKm }
    })
    .filter((salon): salon is Salon => salon != null)

  withDistance.sort((a, b) => a.distanceKm - b.distanceKm)
  return withDistance
}

/** City salons with their distance from the pin, nearest first; salons with no pin go last. */
function citySalonsByDistance(
  salons: Salon[],
  location: SavedLocation & { latitude: number; longitude: number },
): Salon[] {
  const withDistance = salons.map((salon) => withSalonDistanceFromLocation(salon, location))
  return withDistance.sort((a, b) => {
    const left = a.distanceKm > 0 ? a.distanceKm : Number.POSITIVE_INFINITY
    const right = b.distanceKm > 0 ? b.distanceKm : Number.POSITIVE_INFINITY
    return left - right
  })
}

function mergeById(first: Salon[], second: Salon[]): Salon[] {
  const seen = new Set(first.map((salon) => salon.id))
  return [...first, ...second.filter((salon) => !seen.has(salon.id))]
}

function filterSalonsByLabelText(salons: Salon[], location: SavedLocation): Salon[] {
  const needles = [location.area, location.city, location.label]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value && value.length >= 2))

  if (needles.length === 0) return salons

  return salons.filter((salon) => {
    const haystack = `${salon.area} ${salon.city} ${salon.address}`.toLowerCase()
    return needles.some((needle) => haystack.includes(needle))
  })
}

export function resolveCityLabel(location: SavedLocation | null): string | null {
  const city = location?.city?.trim()
  if (city) return city
  const label = location?.label?.trim()
  if (!label) return null
  // "Area, City" → try last segment
  const parts = label.split(",").map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) return parts[parts.length - 1] ?? null
  return null
}

/**
 * Resolve which salons to show for the saved location + browse mode.
 * Does not apply search/business-type filters — caller layers those on.
 */
export function resolveExploreLocationSalons(input: {
  catalog: Salon[]
  location: SavedLocation | null
  mode: LocationBrowseMode
}): ExploreLocationResult {
  const { catalog, location, mode } = input
  const cityLabel = resolveCityLabel(location)
  const citySalons = cityLabel ? filterSalonsByCity(catalog, cityLabel) : []
  const cityCount = citySalons.length

  if (hasCoords(location)) {
    const nearby = filterSalonsNearby(
      catalog,
      location.latitude,
      location.longitude,
      NEARBY_RADIUS_KM,
    )
    const nearbyCount = nearby.length

    if (mode === "city") {
      if (cityCount === 0) {
        return {
          salons: [],
          emptyKind: "out_of_service",
          cityLabel,
          nearbyCount,
          cityCount,
          scopeLabel: cityLabel ? `In ${cityLabel}` : null,
        }
      }
      return {
        salons: citySalonsByDistance(citySalons, location),
        emptyKind: "none",
        cityLabel,
        nearbyCount,
        cityCount,
        scopeLabel: cityLabel ? `In ${cityLabel}` : null,
        radiusKm: null,
        widened: false,
      }
    }

    // mode === nearby
    const anchor = location.area?.trim() || location.label
    if (nearbyCount >= WIDEN_MIN_RESULTS) {
      return {
        salons: nearby,
        emptyKind: "none",
        cityLabel,
        nearbyCount,
        cityCount,
        scopeLabel: `Within ${NEARBY_RADIUS_KM} km of ${anchor}`,
        radiusKm: NEARBY_RADIUS_KM,
        widened: false,
      }
    }

    // Too few close by: try 25 km, then the whole city, before showing an empty state.
    const wide = filterSalonsNearby(
      catalog,
      location.latitude,
      location.longitude,
      WIDE_RADIUS_KM,
    )
    if (wide.length >= WIDEN_MIN_RESULTS || (wide.length > nearbyCount && wide.length >= cityCount)) {
      return {
        salons: wide,
        emptyKind: "none",
        cityLabel,
        nearbyCount,
        cityCount,
        scopeLabel: `Salons a little further away · within ${WIDE_RADIUS_KM} km`,
        radiusKm: WIDE_RADIUS_KM,
        widened: true,
      }
    }

    if (cityCount > Math.max(nearbyCount, wide.length) && cityLabel) {
      // Keep the closest ones first, then the rest of the city.
      const merged = mergeById(wide, citySalonsByDistance(citySalons, location))
      return {
        salons: merged,
        emptyKind: "none",
        cityLabel,
        nearbyCount,
        cityCount,
        scopeLabel: `Salons a little further away · in ${cityLabel}`,
        radiusKm: null,
        widened: true,
      }
    }

    if (nearbyCount > 0) {
      return {
        salons: nearby,
        emptyKind: "none",
        cityLabel,
        nearbyCount,
        cityCount,
        scopeLabel: `Within ${NEARBY_RADIUS_KM} km of ${anchor}`,
        radiusKm: NEARBY_RADIUS_KM,
        widened: false,
      }
    }

    return {
      salons: [],
      emptyKind: "out_of_service",
      cityLabel,
      nearbyCount,
      cityCount,
      scopeLabel: null,
      radiusKm: null,
      widened: false,
    }
  }

  // No coords — soft text match on area/city/label
  if (!location) {
    return {
      salons: catalog,
      emptyKind: "none",
      cityLabel: null,
      nearbyCount: 0,
      cityCount: 0,
      scopeLabel: null,
    }
  }

  if (mode === "city" && cityLabel) {
    if (cityCount === 0) {
      return {
        salons: [],
        emptyKind: "out_of_service",
        cityLabel,
        nearbyCount: 0,
        cityCount,
        scopeLabel: `In ${cityLabel}`,
      }
    }
    return {
      salons: citySalons,
      emptyKind: "none",
      cityLabel,
      nearbyCount: 0,
      cityCount,
      scopeLabel: `In ${cityLabel}`,
    }
  }

  const areaMatched = filterSalonsByLabelText(catalog, location)
  if (areaMatched.length > 0) {
    return {
      salons: areaMatched,
      emptyKind: "none",
      cityLabel,
      nearbyCount: areaMatched.length,
      cityCount,
      scopeLabel: location.area?.trim()
        ? `Near ${location.area.trim()}`
        : `Near ${location.label}`,
    }
  }

  if (cityCount > 0 && cityLabel) {
    return {
      salons: [],
      emptyKind: "nearby_city_available",
      cityLabel,
      nearbyCount: 0,
      cityCount,
      scopeLabel: null,
    }
  }

  // Unknown city / no match — if label looks like a real place, treat as out of service
  // rather than dumping the full catalog.
  if (normalizeCityName(location.label) || cityLabel) {
    return {
      salons: [],
      emptyKind: "out_of_service",
      cityLabel,
      nearbyCount: 0,
      cityCount,
      scopeLabel: null,
    }
  }

  return {
    salons: catalog,
    emptyKind: "none",
    cityLabel: null,
    nearbyCount: 0,
    cityCount: 0,
    scopeLabel: null,
  }
}

/**
 * Salons for category counts / chips — same set Explore will list for this mode.
 * No cross-mode fallback (nearby chips must not include city-only salons).
 */
export function salonsInSelectedLocation(
  catalog: Salon[],
  location: SavedLocation | null,
  mode: LocationBrowseMode = browseModeFor(location),
): Salon[] {
  if (!location) return []

  const scoped = resolveExploreLocationSalons({
    catalog,
    location,
    mode,
  })
  if (scoped.salons.length > 0 && scoped.emptyKind === "none") {
    return scoped.salons
  }

  return []
}

function normalizeAreaName(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function currentAreaLabel(location: SavedLocation | null): string | null {
  const area = location?.area?.trim()
  if (area) return area
  const label = location?.label?.trim()
  if (!label) return null
  return label.split(",")[0]?.trim() || null
}

export function isSalonInCurrentArea(
  salon: Salon,
  location: SavedLocation | null,
): boolean {
  const area = normalizeAreaName(currentAreaLabel(location))
  if (area.length < 3) return false

  const salonArea = normalizeAreaName(salon.area)
  const salonAddress = normalizeAreaName(salon.address)
  if (salonArea.length >= 3) {
    if (salonArea === area || salonArea.includes(area) || area.includes(salonArea)) {
      return true
    }
  }
  return salonAddress.includes(area)
}

/**
 * Current locality first, then other salons still inside the nearby radius.
 * If nothing matches the current area, keep a single list.
 */
export function partitionSalonsByCurrentArea(
  salons: Salon[],
  location: SavedLocation | null,
): { local: Salon[]; nearbyAreas: Salon[] } {
  if (!location || salons.length === 0) {
    return { local: salons, nearbyAreas: [] }
  }

  const local: Salon[] = []
  const nearbyAreas: Salon[] = []
  for (const salon of salons) {
    if (isSalonInCurrentArea(salon, location)) local.push(salon)
    else nearbyAreas.push(salon)
  }

  if (local.length === 0 || nearbyAreas.length === 0) {
    return { local: salons, nearbyAreas: [] }
  }

  return { local, nearbyAreas }
}
