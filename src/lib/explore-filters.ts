import { BUSINESS_TYPES, type BusinessType } from "@/data/business-types"
import type { Salon } from "@/data/types"
import type { ArtistCardData } from "@/lib/artists-api"

export const EXPLORE_SORT_FILTERS = [
  { id: "recommended", label: "Recommended" },
  { id: "rating", label: "Top rated" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "nearest", label: "Nearest" },
] as const

export const EXPLORE_PRICE_FILTERS = [
  { id: "any", label: "Any price" },
  { id: "under-500", label: "Under ₹500" },
  { id: "500-1000", label: "₹500–₹1,000" },
  { id: "1000-plus", label: "₹1,000+" },
] as const

export const EXPLORE_RATING_FILTERS = [
  { id: "any", label: "Any rating" },
  { id: "4", label: "4.0+ stars" },
  { id: "4.5", label: "4.5+ stars" },
] as const

export const EXPLORE_RADIUS_FILTERS = [
  { id: "any", label: "Any distance", radiusKm: null },
  { id: "1", label: "Within 1 km", radiusKm: 1 },
  { id: "3", label: "Within 3 km", radiusKm: 3 },
  { id: "5", label: "Within 5 km", radiusKm: 5 },
  { id: "10", label: "Within 10 km", radiusKm: 10 },
  { id: "25", label: "Within 25 km", radiusKm: 25 },
] as const

export const EXPLORE_CATEGORY_FILTERS = [
  { id: "all" as const, label: "All" },
  ...BUSINESS_TYPES.map((label) => ({ id: label, label })),
]

export type ExploreSortId = (typeof EXPLORE_SORT_FILTERS)[number]["id"]
export type ExplorePriceId = (typeof EXPLORE_PRICE_FILTERS)[number]["id"]
export type ExploreRatingId = (typeof EXPLORE_RATING_FILTERS)[number]["id"]
export type ExploreRadiusId = (typeof EXPLORE_RADIUS_FILTERS)[number]["id"]
export type ExploreCategoryId = "all" | BusinessType

export type ExploreFilterState = {
  category: ExploreCategoryId
  sort: ExploreSortId
  price: ExplorePriceId
  rating: ExploreRatingId
  radius: ExploreRadiusId
  openOnly: boolean
}

export const DEFAULT_EXPLORE_FILTERS: ExploreFilterState = {
  category: "all",
  sort: "recommended",
  price: "any",
  rating: "any",
  radius: "any",
  openOnly: false,
}

export function resolveExploreRadiusKm(radius: ExploreRadiusId): number | null {
  return EXPLORE_RADIUS_FILTERS.find((filter) => filter.id === radius)?.radiusKm ?? null
}

function matchesPriceFilter(priceFrom: number, price: ExplorePriceId): boolean {
  if (price === "any") return true
  if (priceFrom <= 0) return true
  if (price === "under-500") return priceFrom < 500
  if (price === "500-1000") return priceFrom >= 500 && priceFrom <= 1000
  return priceFrom > 1000
}

function matchesRatingFilter(
  rating: number,
  reviews: number,
  minRating: ExploreRatingId,
): boolean {
  if (minRating === "any") return true
  if (rating <= 0 || reviews <= 0) return false
  if (minRating === "4") return rating >= 4
  return rating >= 4.5
}

export function countActiveExploreFilters(state: ExploreFilterState): number {
  let count = 0
  if (state.category !== "all") count += 1
  if (state.price !== "any") count += 1
  if (state.rating !== "any") count += 1
  if (state.radius !== "any") count += 1
  if (state.openOnly) count += 1
  return count
}

export function filterExploreSalons(
  salons: Salon[],
  state: Pick<ExploreFilterState, "category" | "price" | "rating" | "radius" | "openOnly">,
  options?: { query?: string },
): Salon[] {
  let result = salons
  const query = options?.query?.trim().toLowerCase()

  if (state.category !== "all") {
    result = result.filter(
      (salon) => salon.businessType?.trim() === state.category,
    )
  }

  if (query) {
    result = result.filter(
      (salon) =>
        salon.name.toLowerCase().includes(query) ||
        salon.area.toLowerCase().includes(query) ||
        salon.city.toLowerCase().includes(query) ||
        (salon.businessType?.toLowerCase().includes(query) ?? false) ||
        salon.services.some(
          (service) =>
            service.name.toLowerCase().includes(query) ||
            service.category.toLowerCase().includes(query),
        ),
    )
  }

  if (state.price !== "any") {
    result = result.filter((salon) => matchesPriceFilter(salon.priceFrom, state.price))
  }

  if (state.rating !== "any") {
    result = result.filter((salon) =>
      matchesRatingFilter(salon.rating, salon.reviews, state.rating),
    )
  }

  if (state.openOnly) {
    result = result.filter((salon) => salon.isOpenNow)
  }

  const radiusKm = resolveExploreRadiusKm(state.radius)
  if (radiusKm != null) {
    result = result.filter((salon) => {
      // Keep salons without a known distance (same as web).
      if (!(salon.distanceKm > 0)) return true
      return salon.distanceKm <= radiusKm
    })
  }

  return result
}

/** Map/list filters for solo artists (skips salon-only category / open-now). */
export function filterExploreArtists(
  artists: ArtistCardData[],
  state: Pick<ExploreFilterState, "price" | "rating" | "radius">,
  options?: { query?: string },
): ArtistCardData[] {
  let result = artists
  const query = options?.query?.trim().toLowerCase()

  if (query) {
    result = result.filter(
      (artist) =>
        artist.displayName.toLowerCase().includes(query) ||
        (artist.area?.toLowerCase().includes(query) ?? false) ||
        (artist.city?.toLowerCase().includes(query) ?? false) ||
        artist.categories.some((id) => id.toLowerCase().includes(query)),
    )
  }

  if (state.price !== "any") {
    result = result.filter((artist) =>
      matchesPriceFilter(Number(artist.startingPrice) || 0, state.price),
    )
  }

  if (state.rating !== "any") {
    result = result.filter((artist) =>
      matchesRatingFilter(
        Number(artist.averageRating) || 0,
        Number(artist.reviewCount) || 0,
        state.rating,
      ),
    )
  }

  const radiusKm = resolveExploreRadiusKm(state.radius)
  if (radiusKm != null) {
    result = result.filter((artist) => {
      if (artist.distanceKm == null || !(artist.distanceKm > 0)) return true
      return artist.distanceKm <= radiusKm
    })
  }

  return result
}

function recommendScore(salon: Salon): number {
  let score = 0
  if (salon.isFeatured) score += 1_000
  if (salon.rating > 0) score += salon.rating * 100
  score += Math.min(salon.reviews, 200)
  if (salon.isOpenNow) score += 10
  return score
}

export function sortExploreSalons(salons: Salon[], sort: ExploreSortId): Salon[] {
  const sorted = [...salons]

  if (sort === "nearest") {
    return sorted.sort((a, b) => {
      const aDistance = a.distanceKm > 0 ? a.distanceKm : Number.POSITIVE_INFINITY
      const bDistance = b.distanceKm > 0 ? b.distanceKm : Number.POSITIVE_INFINITY
      return aDistance - bDistance
    })
  }

  if (sort === "recommended") {
    return sorted.sort((a, b) => recommendScore(b) - recommendScore(a))
  }

  if (sort === "rating") {
    return sorted.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating
      return b.reviews - a.reviews
    })
  }

  if (sort === "price-asc") {
    return sorted.sort((a, b) => {
      const aPrice = a.priceFrom > 0 ? a.priceFrom : Number.POSITIVE_INFINITY
      const bPrice = b.priceFrom > 0 ? b.priceFrom : Number.POSITIVE_INFINITY
      return aPrice - bPrice
    })
  }

  return sorted.sort((a, b) => b.priceFrom - a.priceFrom)
}
