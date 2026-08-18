import type { Salon } from "@/data/types"
import { filterSalonsByCity, normalizeCityName } from "@/lib/city-filter"
import { haversineKm } from "@/lib/geo"
import type { SavedLocation } from "@/lib/user"

/** Matches Glammzo-web DEFAULT_NEARBY_RADIUS_KM */
export const NEARBY_RADIUS_KM = 10

export type LocationBrowseMode = "nearby" | "city"

export type LocationEmptyKind = "none" | "nearby_city_available" | "out_of_service"

export type ExploreLocationResult = {
  salons: Salon[]
  emptyKind: LocationEmptyKind
  cityLabel: string | null
  nearbyCount: number
  cityCount: number
  scopeLabel: string | null
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
        salons: citySalons.map((salon) => {
          if (
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
        }),
        emptyKind: "none",
        cityLabel,
        nearbyCount,
        cityCount,
        scopeLabel: cityLabel ? `In ${cityLabel}` : null,
      }
    }

    // mode === nearby
    if (nearbyCount > 0) {
      const anchor = location.area?.trim() || location.label
      return {
        salons: nearby,
        emptyKind: "none",
        cityLabel,
        nearbyCount,
        cityCount,
        scopeLabel: `Within ${NEARBY_RADIUS_KM} km of ${anchor}`,
      }
    }

    if (cityCount > 0 && cityLabel) {
      return {
        salons: [],
        emptyKind: "nearby_city_available",
        cityLabel,
        nearbyCount,
        cityCount,
        scopeLabel: null,
      }
    }

    return {
      salons: [],
      emptyKind: "out_of_service",
      cityLabel,
      nearbyCount,
      cityCount,
      scopeLabel: null,
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
  mode: LocationBrowseMode = "nearby",
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
