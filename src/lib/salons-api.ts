import AsyncStorage from "@react-native-async-storage/async-storage"

import { getSalonById as getMockSalonById, mockSalons } from "@/data/mocks/salons"
import type {
  Salon,
  SalonAmenities,
  SalonOffer,
  SalonPackage,
  SalonReview,
  SalonService,
  SalonTaxInfo,
  ServicePriceOption,
} from "@/data/types"
import { ApiError, apiFetch } from "@/lib/api"
import {
  parsePackageGenderAudience,
  parseServiceGenderAudience,
} from "@/lib/gender-audience"
import { parsePricingUnit } from "@/lib/pricing-unit"

const CACHE_TTL_MS = 60_000
const CATALOG_STORAGE_KEY = "glammzo_salon_catalog_v1"

type CacheEntry = {
  at: number
  salons: Salon[]
  source: "live" | "mock"
}

let cache: CacheEntry | null = null

/** Loose web payload — map only fields mobile needs. */
type WebSalon = {
  id?: unknown
  name?: unknown
  area?: unknown
  city?: unknown
  imageUrl?: unknown
  coverImageUrl?: unknown
  rating?: unknown
  reviews?: unknown
  distanceKm?: unknown
  latitude?: unknown
  longitude?: unknown
  isFeatured?: unknown
  is_featured?: unknown
  businessType?: unknown
  isOpenNow?: unknown
  priceFrom?: unknown
  shortDescription?: unknown
  longDescription?: unknown
  description?: unknown
  address?: unknown
  phone?: unknown
  whatsappPhone?: unknown
  whatsapp_phone?: unknown
  hours?: unknown
  services?: unknown
  packages?: unknown
  offers?: unknown
  gallery?: unknown
  amenities?: unknown
  customerReviews?: unknown
  team?: unknown
  tax?: unknown
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback
}

function mapTax(raw: unknown): SalonTaxInfo | null {
  if (!raw || typeof raw !== "object") return null
  const tax = raw as Record<string, unknown>
  const gstNumber = asString(tax.gstNumber).trim().toUpperCase()
  const ratePercent = asNumber(tax.ratePercent, 0)
  const enabled = tax.enabled === true
  if (!enabled || !gstNumber || !(ratePercent > 0)) return null
  return { enabled: true, ratePercent, gstNumber }
}

function mapService(raw: unknown): SalonService | null {
  if (!raw || typeof raw !== "object") return null
  const s = raw as Record<string, unknown>
  const id = asString(s.id)
  const name = asString(s.name)
  if (!id || !name) return null
  const includes = Array.isArray(s.includes)
    ? s.includes.filter((item): item is string => typeof item === "string")
    : []
  const priceOptions = Array.isArray(s.priceOptions)
    ? s.priceOptions
        .map((option): ServicePriceOption | null => {
          if (!option || typeof option !== "object") return null
          const row = option as Record<string, unknown>
          const optionId = asString(row.id)
          const optionName = asString(row.name).trim()
          const optionPrice = asNumber(row.price)
          if (!optionId || !optionName || !(optionPrice > 0)) return null
          return { id: optionId, name: optionName, price: optionPrice }
        })
        .filter((option): option is ServicePriceOption => option != null)
    : []
  const pricingUnit = parsePricingUnit(s.pricingUnit) ?? undefined
  const genderAudience = parseServiceGenderAudience(s.genderAudience)
  return {
    id,
    name,
    durationMin: asNumber(s.durationMin, 30),
    price: asNumber(s.price),
    compareAtPrice: (() => {
      const compare = asNumber(s.compareAtPrice, Number.NaN)
      return Number.isFinite(compare) && compare > 0 ? compare : undefined
    })(),
    category: asString(s.category, "Services"),
    imageUrl: asString(s.imageUrl),
    description: typeof s.description === "string" ? s.description : undefined,
    includes,
    ...(pricingUnit ? { pricingUnit } : {}),
    ...(genderAudience ? { genderAudience } : {}),
    ...(priceOptions.length >= 2 ? { priceOptions } : {}),
  }
}

function mapPackage(raw: unknown, fallbackImage = ""): SalonPackage | null {
  if (!raw || typeof raw !== "object") return null
  const p = raw as Record<string, unknown>
  const id = asString(p.id)
  const name = asString(p.name)
  if (!id || !name) return null
  const items = Array.isArray(p.items)
    ? p.items
        .map((item) => {
          if (!item || typeof item !== "object") return null
          const row = item as Record<string, unknown>
          const serviceId =
            asString(row.serviceId) || asString(row.service_id)
          const serviceName =
            asString(row.serviceName) ||
            asString(row.service_name) ||
            asString(row.name) ||
            "Service"
          if (!serviceId) return null
          return {
            serviceId,
            serviceName,
            quantity: Math.max(1, asNumber(row.quantity, 1)),
          }
        })
        .filter((item): item is NonNullable<typeof item> => item != null)
    : []
  const packagePrice = asNumber(p.packagePrice ?? p.package_price)
  const comparePrice = asNumber(p.comparePrice ?? p.original_price ?? p.compare_price)
  const totalDurationMin = asNumber(
    p.totalDurationMin ?? p.total_duration,
  )
  return {
    id,
    name,
    shortDescription:
      asString(p.shortDescription) ||
      asString(p.short_description) ||
      asString(p.description),
    imageUrl:
      asString(p.imageUrl) || asString(p.image_url) || fallbackImage,
    packagePrice,
    comparePrice,
    totalDurationMin,
    items,
    badge: typeof p.badge === "string" ? p.badge : p.badge === null ? null : undefined,
    isFeatured: typeof p.isFeatured === "boolean" ? p.isFeatured : Boolean(p.is_featured),
    prepaidEnabled: p.prepaidEnabled === true || p.prepaid_enabled === true,
    showComparePrice:
      typeof p.showComparePrice === "boolean"
        ? p.showComparePrice
        : p.show_compare_price !== false,
    genderAudience: parsePackageGenderAudience(
      p.genderAudience ?? p.gender_audience,
    ),
  }
}

function mapOffer(raw: unknown): SalonOffer | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id = asString(o.id)
  const title = asString(o.title)
  if (!id || !title) return null
  const discountType = o.discountType === "fixed" ? "fixed" : "percent"
  const code = asString(o.code).trim().toUpperCase()
  const minOrder =
    typeof o.minOrderRupees === "number" && Number.isFinite(o.minOrderRupees)
      ? Math.max(0, Math.round(o.minOrderRupees))
      : null
  return {
    id,
    code,
    title,
    description:
      typeof o.description === "string" && o.description.trim()
        ? o.description.trim()
        : null,
    discountType,
    discountValue: asNumber(o.discountValue),
    appliesTo: o.appliesTo === "selected_services" ? "selected_services" : "all_services",
    serviceIds: Array.isArray(o.serviceIds)
      ? o.serviceIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : Array.isArray(o.service_ids)
        ? o.service_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [],
    startsAt: typeof o.startsAt === "string" ? o.startsAt : null,
    endsAt: typeof o.endsAt === "string" ? o.endsAt : null,
    isActive: asBoolean(o.isActive, true),
    minOrderRupees: minOrder && minOrder > 0 ? minOrder : null,
    customerEligibility:
      o.customerEligibility === "new_customers_only"
        ? "new_customers_only"
        : "all_customers",
    terms:
      typeof o.terms === "string" && o.terms.trim() ? o.terms.trim() : null,
    ctaLabel:
      typeof o.ctaLabel === "string" && o.ctaLabel.trim()
        ? o.ctaLabel.trim()
        : "Book now",
  }
}

function mapReview(raw: unknown): SalonReview | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const id = asString(r.id)
  if (!id) return null
  const staff =
    r.staffMember && typeof r.staffMember === "object"
      ? (r.staffMember as Record<string, unknown>)
      : {}
  return {
    id,
    authorName: asString(r.authorName, "Guest"),
    reviewType: asString(r.reviewType, "Overall experience"),
    rating: asNumber(r.rating, 5),
    date: asString(r.date),
    serviceName: asString(r.serviceName),
    staffMember: {
      name: asString(staff.name),
      role: asString(staff.role),
    },
    comment: asString(r.comment),
    verified: typeof r.verified === "boolean" ? r.verified : undefined,
    ownerReply: typeof r.ownerReply === "string" ? r.ownerReply : r.ownerReply === null ? null : undefined,
    photoUrls: Array.isArray(r.photoUrls)
      ? r.photoUrls.filter((url: unknown): url is string => typeof url === "string").slice(0, 3)
      : undefined,
    ownerReplyDate:
      typeof r.ownerReplyDate === "string"
        ? r.ownerReplyDate
        : r.ownerReplyDate === null
          ? null
          : undefined,
  }
}

function mapAmenities(raw: unknown): SalonAmenities | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const a = raw as Record<string, unknown>
  if (!Array.isArray(a.categories)) return undefined
  const categories = a.categories
    .map((cat) => {
      if (!cat || typeof cat !== "object") return null
      const c = cat as Record<string, unknown>
      const name = asString(c.name)
      if (!name) return null
      return {
        icon: asString(c.icon, "checkmark-circle-outline"),
        name,
        visible: typeof c.visible === "boolean" ? c.visible : undefined,
        items: Array.isArray(c.items)
          ? c.items.filter((item): item is string => typeof item === "string")
          : undefined,
      }
    })
    .filter((cat): cat is NonNullable<typeof cat> => cat != null)
  return categories.length > 0 ? { categories } : undefined
}

function mapTeam(raw: unknown): Salon["team"] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((member) => {
      if (!member || typeof member !== "object") return null
      const m = member as Record<string, unknown>
      const id = asString(m.id)
      const name = asString(m.name) || asString(m.full_name) || asString(m.fullName)
      if (!id || !name) return null
      const bio = asString(m.bio)
      const imageUrl = asString(m.imageUrl) || asString(m.image_url)
      return {
        id,
        name,
        role: asString(m.role, "Specialist"),
        ...(bio ? { bio } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      }
    })
    .filter((member): member is NonNullable<typeof member> => member != null)
}

export function mapWebSalonToMobile(raw: WebSalon): Salon | null {
  const id = asString(raw.id)
  const name = asString(raw.name)
  if (!id || !name) return null

  const longDescription = asString(raw.longDescription)
  const description =
    asString(raw.description) || longDescription || asString(raw.shortDescription)
  const shortDescription =
    asString(raw.shortDescription) || description.slice(0, 120)

  const imageUrl = asString(raw.imageUrl)
  const coverImageUrl = asString(raw.coverImageUrl) || imageUrl
  const services = Array.isArray(raw.services)
    ? raw.services.map(mapService).filter((s): s is SalonService => s != null)
    : []
  const packages = Array.isArray(raw.packages)
    ? raw.packages
        .map((pkg) => mapPackage(pkg, imageUrl || coverImageUrl))
        .filter((p): p is SalonPackage => p != null)
    : []
  const offers = Array.isArray(raw.offers)
    ? raw.offers.map(mapOffer).filter((o): o is SalonOffer => o != null)
    : []
  const gallery = Array.isArray(raw.gallery)
    ? raw.gallery.filter((url): url is string => typeof url === "string" && url.length > 0)
    : []
  const customerReviews = Array.isArray(raw.customerReviews)
    ? raw.customerReviews.map(mapReview).filter((r): r is SalonReview => r != null)
    : []

  const businessType =
    typeof raw.businessType === "string" && raw.businessType.trim()
      ? raw.businessType.trim()
      : undefined

  const latitude = asNumber(raw.latitude, Number.NaN)
  const longitude = asNumber(raw.longitude, Number.NaN)

  return {
    id,
    name,
    area: asString(raw.area, "Nearby"),
    city: asString(raw.city, "—"),
    imageUrl,
    coverImageUrl,
    rating: asNumber(raw.rating, 0),
    reviews: asNumber(raw.reviews, customerReviews.length),
    distanceKm: asNumber(raw.distanceKm, 0),
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
    isFeatured:
      raw.isFeatured === true ||
      raw.is_featured === true,
    businessType,
    isOpenNow: asBoolean(raw.isOpenNow, true),
    priceFrom: asNumber(raw.priceFrom, services[0]?.price ?? 0),
    shortDescription,
    description: description || shortDescription,
    address: asString(raw.address),
    phone: asString(raw.phone),
    whatsappPhone: (() => {
      const value = asString(raw.whatsappPhone) || asString(raw.whatsapp_phone)
      return value || undefined
    })(),
    hours: asString(raw.hours, "Hours on request"),
    services,
    packages,
    offers,
    gallery,
    amenities: mapAmenities(raw.amenities),
    customerReviews,
    team: mapTeam(raw.team),
    tax: mapTax(raw.tax),
  }
}

function setCache(salons: Salon[], source: "live" | "mock", at = Date.now()): Salon[] {
  cache = { at, salons, source }
  return salons
}

function cacheFresh(): boolean {
  return cache != null && Date.now() - cache.at < CACHE_TTL_MS
}

function parseStoredCatalog(raw: string): Salon[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return null
    const salons = (parsed as { salons?: unknown }).salons
    if (!Array.isArray(salons) || salons.length === 0) return null
    const valid = salons.filter((row): row is Salon => {
      if (!row || typeof row !== "object") return false
      const salon = row as Salon
      return (
        typeof salon.id === "string" &&
        salon.id.length > 0 &&
        typeof salon.name === "string" &&
        Array.isArray(salon.services)
      )
    })
    return valid.length > 0 ? valid : null
  } catch {
    return null
  }
}

let hydratePromise: Promise<void> | null = null

/** Load last successful live catalog from disk into memory. Does not network. */
export function hydrateCatalogFromStorage(): Promise<void> {
  if (cache) return Promise.resolve()
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(CATALOG_STORAGE_KEY)
        if (!raw || cache) return
        const salons = parseStoredCatalog(raw)
        if (!salons) return
        // `at: 0` so TTL is stale and a live refetch still runs.
        setCache(salons, "live", 0)
      } catch (error) {
        console.warn("[Glammzo] catalog disk hydrate failed", error)
      } finally {
        if (!cache) hydratePromise = null
      }
    })()
  }
  return hydratePromise
}

async function persistLiveCatalog(salons: Salon[]) {
  try {
    if (salons.length === 0) {
      await AsyncStorage.removeItem(CATALOG_STORAGE_KEY)
      return
    }
    await AsyncStorage.setItem(
      CATALOG_STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), salons }),
    )
  } catch (error) {
    console.warn("[Glammzo] catalog disk persist failed", error)
  }
}

/** Sync resolve: live cache first, then mocks in __DEV__ only (cart strip / sheets). */
export function resolveSalonById(id: string): Salon | undefined {
  const live = cache?.salons.find((salon) => salon.id === id)
  if (live) return live
  return __DEV__ ? getMockSalonById(id) : undefined
}

/** Peek current catalog (cache, or mocks in __DEV__ only). Does not network. */
export function getCatalogSnapshot(): Salon[] {
  if (cache?.salons) return cache.salons
  return __DEV__ ? mockSalons : []
}

export type FetchSalonsResult = {
  salons: Salon[]
  source: "live" | "mock" | "disk"
  fromCache: boolean
}

/**
 * Fetch published salons from Glammzo-web `GET /api/salons`.
 * Shared in-memory cache (~60s) plus last-good catalog on disk.
 * Mock fallback is __DEV__ only — production builds never show fake salons.
 */
export async function fetchSalons(options?: {
  force?: boolean
}): Promise<FetchSalonsResult> {
  await hydrateCatalogFromStorage()
  if (!options?.force && cacheFresh() && cache) {
    return { salons: cache.salons, source: cache.source, fromCache: false }
  }

  try {
    const payload = await apiFetch<unknown>("/api/salons", { auth: false })
    if (!Array.isArray(payload)) {
      throw new Error("Unexpected /api/salons payload")
    }
    const salons = payload
      .map((row) => mapWebSalonToMobile(row as WebSalon))
      .filter((salon): salon is Salon => salon != null)
    // Empty catalog is still live so UI can show a real empty state
    setCache(salons, "live")
    void persistLiveCatalog(salons)
    return { salons, source: "live", fromCache: false }
  } catch (error) {
    if (cache && cache.salons.length > 0) {
      // Refresh TTL so tab focus does not wait 12s on every visit while offline.
      setCache(cache.salons, cache.source)
      console.warn("[Glammzo] salons API failed; using cached catalog", error)
      return {
        salons: cache.salons,
        source: cache.source === "mock" ? "mock" : "disk",
        fromCache: true,
      }
    }
    if (__DEV__) {
      console.warn("[Glammzo] salons API failed; using mocks", error)
      const salons = setCache(mockSalons, "mock")
      return { salons, source: "mock", fromCache: true }
    }
    console.warn("[Glammzo] salons API failed", error)
    if (error instanceof ApiError) throw error
    throw new ApiError(0, "Could not load salons. Check your connection and try again.")
  }
}

/**
 * Resolve one salon from cache/list; refetch list on miss.
 * Mock id fallback is __DEV__ only.
 */
export async function getSalonByIdLive(id: string): Promise<Salon | undefined> {
  await hydrateCatalogFromStorage()
  const cached = cache?.salons.find((salon) => salon.id === id)
  if (cached) return cached

  try {
    const { salons } = await fetchSalons({ force: !cacheFresh() })
    const found = salons.find((salon) => salon.id === id)
    if (found) return found
  } catch (error) {
    console.warn("[Glammzo] salon lookup failed", error)
  }

  if (__DEV__) {
    return getMockSalonById(id)
  }
  return undefined
}
