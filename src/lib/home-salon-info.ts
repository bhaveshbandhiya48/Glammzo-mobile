import type { Salon } from "@/data/types"
import { isUnisexSalonBusiness } from "@/lib/gender-audience"
import { matchesTile, tilesMatching, type HomeAudience, type ServiceTile } from "@/lib/service-tiles"

/**
 * "Women only" / "Men only" / "Unisex" — only from data we already have:
 * the CRM business type "Unisex Salon", or every service tagged for one audience.
 * Returns null rather than guessing.
 */
export function salonAudienceBadge(salon: Salon): string | null {
  if (isUnisexSalonBusiness(salon.businessType)) return "Unisex"
  const services = salon.services
  if (services.length === 0) return null
  const audiences = new Set(services.map((service) => service.genderAudience ?? null))
  if (audiences.size !== 1) return null
  const only = [...audiences][0]
  if (only === "women") return "Women only"
  if (only === "men") return "Men only"
  return null
}

const NO_HOURS = new Set(["", "hours on request", "hours not listed"])

/** True when the salon has real opening hours (so `isOpenNow` means something). */
export function hasOpeningHours(salon: Salon): boolean {
  return !NO_HOURS.has((salon.hours ?? "").trim().toLowerCase())
}

/** "Haircut, Facial" from the salon's own services; falls back to the business type. */
export function salonTopServicesLabel(salon: Salon, max = 2): string | null {
  const tiles = tilesMatching(salon.services.flatMap((service) => [service.name, service.category]))
  if (tiles.length > 0) {
    return tiles
      .slice(0, max)
      .map((tile) => tile.label)
      .join(", ")
  }
  return salon.businessType?.trim() || null
}

/** Top rated first; ties by review count. Salons with no rating are left out. */
export function topRatedSalons(salons: Salon[], limit = 10): Salon[] {
  return salons
    .filter((salon) => salon.rating > 0)
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews || a.distanceKm - b.distanceKm)
    .slice(0, limit)
}

/**
 * Salons offering a tile's service (whole-word match on service name or category).
 * With an audience, a salon whose matching services are all tagged for the other
 * audience is left out; untagged services count for both.
 */
export function salonsForTile(
  salons: Salon[],
  tile: ServiceTile,
  audience?: HomeAudience | null,
): Salon[] {
  return salons.filter((salon) => {
    const matching = salon.services.filter(
      (service) => matchesTile(service.name, tile) || matchesTile(service.category, tile),
    )
    if (matching.length === 0) return false
    if (!audience) return true
    return matching.some((service) => !service.genderAudience || service.genderAudience === audience)
  })
}
