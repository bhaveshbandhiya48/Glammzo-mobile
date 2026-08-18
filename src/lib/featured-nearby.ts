import type { Salon } from "@/data/types"

export const FEATURED_SECTION_LIMIT = 6

function distanceSort(a: Salon, b: Salon) {
  return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY)
}

/**
 * Featured section: only salons marked featured by super admin (nearest first).
 * If none are featured in the current area, hide the section.
 */
export function pickFeaturedSectionSalons(
  salons: Salon[],
  limit = FEATURED_SECTION_LIMIT,
): { salons: Salon[]; usedNearbyFallback: boolean } {
  const featured = salons
    .filter((salon) => salon.isFeatured === true)
    .sort(distanceSort)

  return {
    salons: featured.slice(0, limit),
    usedNearbyFallback: false,
  }
}

/**
 * Nearby grid after Featured: exclude Featured IDs so they are not repeated.
 * Keep the rest of the 10 km set (current area first is applied by the caller).
 */
export function pickNearbyAfterFeatured(
  allSalons: Salon[],
  featuredSalons: Salon[],
): Salon[] {
  if (featuredSalons.length === 0) {
    return [...allSalons]
  }

  const featuredIds = new Set(featuredSalons.map((salon) => salon.id))
  return allSalons.filter((salon) => !featuredIds.has(salon.id))
}
