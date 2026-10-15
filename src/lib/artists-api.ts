import AsyncStorage from "@react-native-async-storage/async-storage"

import { apiFetch } from "@/lib/api"
import { CRM_URL } from "@/lib/config"

const HOME_ARTISTS_STORAGE_KEY = "glammzo_home_artists_v1"
const HOME_ARTISTS_TTL_MS = 60_000
const HOME_ARTISTS_LIMIT = 12

type HomeArtistsCache = {
  at: number
  key: string
  artists: ArtistCardData[]
  labels: Record<string, string>
}

let homeArtistsMemory: HomeArtistsCache | null = null
let homeArtistsHydrated = false
let homeArtistsInflight: Promise<HomeArtistsCache | null> | null = null

function homeArtistsCacheKey(latitude?: number, longitude?: number) {
  if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `nearest:${latitude.toFixed(3)},${longitude.toFixed(3)}`
  }
  return "recommended"
}

function titleCaseId(id: string) {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export type ArtistCategory = { id: string; label: string; icon: string; count: number }
export type ArtistOccasion = { id: string; label: string; count: number }

export type ArtistCardData = {
  slug: string
  url: string
  displayName: string
  area: string | null
  city: string | null
  profilePhotoUrl: string | null
  categories: string[]
  primaryCategory: string | null
  startingPrice: number | null
  offersHomeVisits: boolean
  hasStudio: boolean
  serviceRadiusKm: number | null
  yearsExperience: number | null
  portfolio: string[]
  distanceKm: number | null
  coversYourArea: boolean | null
}

export type ArtistWhere = "any" | "home" | "studio"
export type ArtistSort = "recommended" | "nearest" | "price-asc" | "price-desc"

export type ArtistQuery = {
  category?: string | null
  occasion?: string | null
  where?: ArtistWhere
  q?: string
  latitude?: number
  longitude?: number
  sort?: ArtistSort
  offset?: number
}

export type PublicArtistService = {
  id: string
  name: string
  category: string | null
  description: string | null
  durationMinutes: number
  price: number
  locationMode: "studio" | "client_home" | "both"
  homeVisitPriceOverride: number | null
}

export type PublicArtistPortfolioItem = {
  id: string
  imageUrl: string
  thumbnailUrl: string | null
  caption: string | null
  category: string | null
}

export type PublicArtistReview = {
  id: string
  rating: number
  reviewType: string
  comment: string
  verified: boolean
  ownerReply: string | null
  ownerReplyAt: string | null
  createdAt: string
  serviceName: string | null
  authorName: string
}

export type PublicArtist = {
  displayName: string
  slug: string
  bio: string | null
  categories: string[]
  city: string | null
  area: string | null
  profilePhotoUrl: string | null
  instagramHandle: string | null
  yearsExperience: number | null
  offersHomeVisits: boolean
  serviceRadiusKm: number
  travelFeeType: "none" | "flat" | "per_km"
  travelFeeAmount: number
  advancePaymentRequired: boolean
  cancellationPolicyText: string | null
  services: PublicArtistService[]
  portfolio?: PublicArtistPortfolioItem[]
  averageRating?: number
  reviewCount?: number
  reviews?: PublicArtistReview[]
  timezone?: string
}

export type ArtistBookingQuote = {
  ok?: boolean
  servicePrice: number
  travelFee: number
  distanceKm: number | null
  total: number
  advance: number
}

export type ArtistLocationType = "studio" | "client_home"

/** Studio base price, or home override when booking a home visit. */
export function artistServiceUnitPrice(
  service: Pick<PublicArtistService, "price" | "homeVisitPriceOverride">,
  locationType: ArtistLocationType = "studio",
): number {
  if (
    locationType === "client_home" &&
    service.homeVisitPriceOverride != null &&
    Number.isFinite(service.homeVisitPriceOverride)
  ) {
    return Number(service.homeVisitPriceOverride)
  }
  return Number(service.price) || 0
}

const TIMEOUT_MS = 12_000

async function crmGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  signal?.addEventListener("abort", () => controller.abort())
  try {
    const response = await fetch(`${CRM_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
    const data = (await response.json().catch(() => ({}))) as T & { error?: string }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
    return data
  } finally {
    clearTimeout(timer)
  }
}

async function crmPost<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${CRM_URL}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const data = (await response.json().catch(() => ({}))) as T & { error?: string }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
    return data
  } finally {
    clearTimeout(timer)
  }
}

/** Null when the artist module is off or unreachable, so the app simply hides the section. */
export async function fetchArtistCategories(): Promise<{
  total: number
  categories: ArtistCategory[]
  occasions: ArtistOccasion[]
} | null> {
  try {
    return await crmGet("/api/public/artists/categories")
  } catch {
    return null
  }
}

export async function fetchArtists(query: ArtistQuery, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (query.category) params.set("category", query.category)
  if (query.occasion) params.set("occasion", query.occasion)
  if (query.where && query.where !== "any") params.set("where", query.where)
  if (query.q?.trim()) params.set("q", query.q.trim())
  if (query.latitude !== undefined && query.longitude !== undefined) {
    params.set("lat", String(query.latitude))
    params.set("lng", String(query.longitude))
  }
  if (query.sort) params.set("sort", query.sort)
  if (query.offset) params.set("offset", String(query.offset))
  params.set("limit", "20")
  return crmGet<{ artists: ArtistCardData[]; total: number; hasMore: boolean }>(
    `/api/public/artists?${params}`,
    signal,
  )
}

export function getHomeArtistsSnapshot(latitude?: number, longitude?: number) {
  const key = homeArtistsCacheKey(latitude, longitude)
  if (!homeArtistsMemory || homeArtistsMemory.key !== key) return null
  return homeArtistsMemory
}

async function hydrateHomeArtistsFromStorage() {
  if (homeArtistsHydrated) return
  homeArtistsHydrated = true
  try {
    const raw = await AsyncStorage.getItem(HOME_ARTISTS_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as HomeArtistsCache
    if (
      !parsed ||
      typeof parsed.at !== "number" ||
      typeof parsed.key !== "string" ||
      !Array.isArray(parsed.artists)
    ) {
      return
    }
    if (!homeArtistsMemory || parsed.at >= homeArtistsMemory.at) {
      homeArtistsMemory = {
        at: parsed.at,
        key: parsed.key,
        artists: parsed.artists,
        labels: parsed.labels ?? {},
      }
    }
  } catch {
    // ignore corrupt cache
  }
}

async function persistHomeArtists(entry: HomeArtistsCache) {
  homeArtistsMemory = entry
  try {
    await AsyncStorage.setItem(HOME_ARTISTS_STORAGE_KEY, JSON.stringify(entry))
  } catch {
    // ignore storage failures
  }
}

/**
 * Home “Solo artists” strip: cached + parallel category labels.
 * Prefetch from Explore so cards appear with salons, not after them.
 */
export async function fetchHomeArtists(input?: {
  latitude?: number
  longitude?: number
  force?: boolean
  signal?: AbortSignal
}): Promise<HomeArtistsCache> {
  const latitude = input?.latitude
  const longitude = input?.longitude
  const key = homeArtistsCacheKey(latitude, longitude)
  const hasPin = key.startsWith("nearest:")

  await hydrateHomeArtistsFromStorage()
  const cached = homeArtistsMemory
  const fresh =
    cached &&
    cached.key === key &&
    Date.now() - cached.at < HOME_ARTISTS_TTL_MS &&
    !input?.force
  if (fresh) return cached

  if (homeArtistsInflight && !input?.force) {
    const shared = await homeArtistsInflight
    if (shared && shared.key === key) return shared
  }

  const run = (async (): Promise<HomeArtistsCache | null> => {
    try {
      const [list, categories] = await Promise.all([
        fetchArtists(
          {
            sort: hasPin ? "nearest" : "recommended",
            latitude: hasPin ? latitude : undefined,
            longitude: hasPin ? longitude : undefined,
          },
          input?.signal,
        ),
        fetchArtistCategories(),
      ])
      const labels: Record<string, string> = {}
      for (const c of categories?.categories ?? []) labels[c.id] = c.label
      const entry: HomeArtistsCache = {
        at: Date.now(),
        key,
        artists: (list.artists ?? []).slice(0, HOME_ARTISTS_LIMIT),
        labels,
      }
      await persistHomeArtists(entry)
      return entry
    } catch {
      if (cached && cached.key === key) return cached
      const empty: HomeArtistsCache = { at: Date.now(), key, artists: [], labels: {} }
      homeArtistsMemory = empty
      return empty
    } finally {
      homeArtistsInflight = null
    }
  })()

  homeArtistsInflight = run
  const result = await run
  return result ?? { at: Date.now(), key, artists: [], labels: {} }
}

/** Kick off home artists load without awaiting (Explore focus). */
export function prefetchHomeArtists(latitude?: number, longitude?: number) {
  void fetchHomeArtists({ latitude, longitude })
}

export function artistCategoryLabel(
  id: string,
  labels?: Record<string, string> | null,
) {
  return labels?.[id] ?? titleCaseId(id)
}

export async function fetchPublicArtist(slug: string, signal?: AbortSignal) {
  const data = await crmGet<{ artist: PublicArtist }>(
    `/api/public/artists/${encodeURIComponent(slug)}`,
    signal,
  )
  return data.artist
}

export async function fetchArtistSlots(input: {
  slug: string
  /** One or more services in the same visit. */
  serviceIds: string[]
  date: string
  locationType: ArtistLocationType
  lat?: number
  lng?: number
  signal?: AbortSignal
}) {
  const ids = input.serviceIds.map((id) => id.trim()).filter(Boolean)
  const params = new URLSearchParams({
    date: input.date,
    locationType: input.locationType,
  })
  if (ids.length === 1) params.set("serviceId", ids[0]!)
  else params.set("serviceIds", ids.join(","))
  if (input.lat != null && input.lng != null) {
    params.set("lat", String(input.lat))
    params.set("lng", String(input.lng))
  }
  return crmGet<{
    slots: string[]
    quote: ArtistBookingQuote | null
    message: string | null
  }>(`/api/public/artists/${encodeURIComponent(input.slug)}/slots?${params}`, input.signal)
}

/**
 * For logged-in Glammzo users: mint CRM verification via Glammzo-web (no second OTP).
 * Requires ARTIST_OTP_ISSUE_SECRET on Glammzo-web + glamzzo-crm.
 */
export async function issueArtistVerificationFromSession() {
  return apiFetch<{ ok: boolean; verificationToken: string; phone: string }>(
    "/api/mobile/artist/verification-token",
    { method: "POST", body: {} },
  )
}

export async function sendArtistBookingOtp(mobile: string) {
  return crmPost<{ challenge: string }>("/api/public/otp/send", { mobile })
}

export async function verifyArtistBookingOtp(input: {
  mobile: string
  otp: string
  challenge: string
}) {
  return crmPost<{ verificationToken: string }>("/api/public/otp/verify", input)
}

export async function createArtistPublicBooking(input: {
  slug: string
  serviceIds: string[]
  startAt: string
  locationType: ArtistLocationType
  address?: string
  landmark?: string | null
  lat?: number
  lng?: number
  fullName: string
  phone: string
  verificationToken: string
  notes?: string | null
}) {
  const serviceIds = input.serviceIds.map((id) => id.trim()).filter(Boolean)
  return crmPost<{
    booking: { token: string; status: string; startsAt: string }
    quote: ArtistBookingQuote
    awaitingPayment: boolean
  }>(`/api/public/artists/${encodeURIComponent(input.slug)}/bookings`, {
    serviceIds,
    serviceId: serviceIds[0],
    startAt: input.startAt,
    locationType: input.locationType,
    ...(input.locationType === "client_home"
      ? {
          address: input.address,
          landmark: input.landmark ?? null,
          lat: input.lat,
          lng: input.lng,
        }
      : {}),
    fullName: input.fullName,
    phone: input.phone,
    verificationToken: input.verificationToken,
    consent: true,
    notes: input.notes ?? null,
  })
}
