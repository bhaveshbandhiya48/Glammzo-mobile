/**
 * Route params for the "See all" list screens (/salons, /artists), so Home's state
 * (audience, service, sort, filters, where) carries across. Everything is optional:
 * the screens still open with no params. Values are plain strings (expo-router params).
 */
import type { ArtistSort, ArtistWhere } from "@/lib/artists-api"
import {
  DEFAULT_EXPLORE_FILTERS,
  EXPLORE_CATEGORY_FILTERS,
  EXPLORE_PRICE_FILTERS,
  EXPLORE_RADIUS_FILTERS,
  EXPLORE_RATING_FILTERS,
  EXPLORE_SORT_FILTERS,
  type ExploreFilterState,
} from "@/lib/explore-filters"
import { parseHomeAudience } from "@/lib/home-audience"
import { getServiceTile, type HomeAudience, type ServiceTileKey } from "@/lib/service-tiles"

type Param = string | string[] | undefined

function one(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function pick<T extends string>(value: Param, options: ReadonlyArray<{ id: T }>): T | undefined {
  const raw = one(value)
  return options.find((option) => option.id === raw)?.id
}

export type SalonsSeeAllParams = {
  sort?: string
  category?: string
  price?: string
  rating?: string
  radius?: string
  open?: string
  audience?: string
  service?: string
}

/** Params for /salons: only the values that differ from the defaults. */
export function salonsSeeAllParams(input: {
  filters?: Partial<ExploreFilterState>
  audience?: HomeAudience | null
  service?: ServiceTileKey | null
}): SalonsSeeAllParams {
  const f = input.filters ?? {}
  const params: SalonsSeeAllParams = {}
  if (f.sort && f.sort !== DEFAULT_EXPLORE_FILTERS.sort) params.sort = f.sort
  if (f.category && f.category !== "all") params.category = f.category
  if (f.price && f.price !== "any") params.price = f.price
  if (f.rating && f.rating !== "any") params.rating = f.rating
  if (f.radius && f.radius !== "any") params.radius = f.radius
  if (f.openOnly) params.open = "1"
  if (input.audience) params.audience = input.audience
  if (input.service) params.service = input.service
  return params
}

/** Reads /salons params back into the screen's initial state; unknown values are ignored. */
export function parseSalonsSeeAllParams(params: Record<string, Param>): {
  filters: ExploreFilterState
  audience: HomeAudience | null
  service: ServiceTileKey | null
} {
  const category = EXPLORE_CATEGORY_FILTERS.find((option) => option.id === one(params.category))?.id
  return {
    filters: {
      ...DEFAULT_EXPLORE_FILTERS,
      sort: pick(params.sort, EXPLORE_SORT_FILTERS) ?? DEFAULT_EXPLORE_FILTERS.sort,
      category: category ?? DEFAULT_EXPLORE_FILTERS.category,
      price: pick(params.price, EXPLORE_PRICE_FILTERS) ?? DEFAULT_EXPLORE_FILTERS.price,
      rating: pick(params.rating, EXPLORE_RATING_FILTERS) ?? DEFAULT_EXPLORE_FILTERS.rating,
      radius: pick(params.radius, EXPLORE_RADIUS_FILTERS) ?? DEFAULT_EXPLORE_FILTERS.radius,
      openOnly: one(params.open) === "1",
    },
    audience: parseHomeAudience(one(params.audience)),
    service: getServiceTile(one(params.service) ?? null)?.key ?? null,
  }
}

export type ArtistsSeeAllParams = {
  where?: string
  sort?: string
  audience?: string
  service?: string
}

/** Params for /artists. "Top rated" isn't an artists API sort, so only these sorts pass. */
export function artistsSeeAllParams(input: {
  where?: ArtistWhere | null
  sort?: ArtistSort | null
  audience?: HomeAudience | null
  service?: ServiceTileKey | null
}): ArtistsSeeAllParams {
  const params: ArtistsSeeAllParams = {}
  if (input.where && input.where !== "any") params.where = input.where
  if (input.sort && input.sort !== "recommended") params.sort = input.sort
  if (input.audience) params.audience = input.audience
  if (input.service) params.service = input.service
  return params
}
