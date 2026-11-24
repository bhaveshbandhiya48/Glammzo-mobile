import { apiFetch } from "@/lib/api"

/** A Glammzo-paid offer as the app shows it (banner, partner page card or checkout). */
export type AppOffer = {
  id: string
  /** "₹200 off" or "20% off up to ₹300". */
  headline: string
  title: string
  terms: string
  code: string | null
  autoApply: boolean
  minOrderRupees: number
  /** India date "YYYY-MM-DD", or null for no end. */
  endsOn: string | null
  bannerUrl: string | null
  /** Banner tap: "salons", "artists" or null (open the offer details). */
  tapTarget: "salons" | "artists" | null
}

export type CheckoutAppOffer = AppOffer & {
  status: "usable" | "almost"
  /** What this booking saves (₹); 0 when it doesn't fit yet. */
  discountRupees: number
  /** Why it doesn't fit yet, e.g. "Add ₹150 more to use this". */
  note: string | null
}

export type CheckoutAppOffers = {
  offers: CheckoutAppOffer[]
  autoApplied: CheckoutAppOffer | null
  /** The offer for a typed code. */
  typed: CheckoutAppOffer | null
  /** Why a typed code didn't work; "not_found" = not a Glammzo code (try the partner's codes). */
  typedError: string | null
}

/** What goes on the booking request as `appOffer`. */
export type AppOfferSelection = {
  offerId?: string | null
  code?: string | null
  /** Let the server apply the best automatic offer when nothing was picked. */
  auto: boolean
}

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function mapOffer(raw: unknown): AppOffer | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id = str(o.id)
  const headline = str(o.headline)
  if (!id || !headline) return null
  const tap = str(o.tapTarget)
  const banner = str(o.bannerUrl)
  return {
    id,
    headline,
    title: str(o.title) || headline,
    terms: str(o.terms),
    code: str(o.code).toUpperCase() || null,
    autoApply: o.autoApply === true,
    minOrderRupees: typeof o.minOrderRupees === "number" ? Math.max(0, Math.round(o.minOrderRupees)) : 0,
    endsOn: /^\d{4}-\d{2}-\d{2}$/.test(str(o.endsOn)) ? str(o.endsOn) : null,
    bannerUrl: banner.startsWith("https://") ? banner : null,
    tapTarget: tap === "salons" || tap === "artists" ? tap : null,
  }
}

function mapCheckoutOffer(raw: unknown): CheckoutAppOffer | null {
  const offer = mapOffer(raw)
  if (!offer) return null
  const o = raw as Record<string, unknown>
  return {
    ...offer,
    status: o.status === "usable" ? "usable" : "almost",
    discountRupees: typeof o.discountRupees === "number" ? Math.max(0, Math.round(o.discountRupees)) : 0,
    note: str(o.note) || null,
  }
}

function mapList(raw: unknown) {
  return Array.isArray(raw) ? raw.map(mapOffer).filter((offer): offer is AppOffer => offer != null) : []
}

async function fetchList(params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value?.trim()) query.set(key, value.trim())
  try {
    const data = await apiFetch<{ offers?: unknown }>(`/api/mobile/app-offers?${query.toString()}`, {
      auth: false,
    })
    return mapList(data.offers)
  } catch {
    return []
  }
}

/** Home banners for the customer's city and area. */
export function fetchHomeAppOffers(place: { city?: string | null; area?: string | null }) {
  return fetchList({ placement: "home", city: place.city, area: place.area })
}

/** Offers that work at this salon. */
export function fetchSalonAppOffers(salonId: string) {
  return fetchList({ placement: "salon", salonId })
}

/** Offers that work with this artist. */
export function fetchArtistAppOffers(artistSlug: string) {
  return fetchList({ placement: "artist", artistSlug })
}

/** Offers for the checkout cart. Needs the customer to be signed in. */
export async function fetchCheckoutAppOffers(
  input:
    | {
        scope: "salon"
        salonId: string
        serviceIds: string[]
        packageId?: string | null
        serviceQuantities?: Record<string, number>
        servicePriceOptionIds?: Record<string, string>
        /** Professional picked (Pro staff level markup). */
        staffId?: string | null
        partnerCode?: string | null
        code?: string | null
      }
    | {
        scope: "artist"
        artistSlug: string
        serviceIds: string[]
        subtotal: number
        partnerCode?: string | null
        code?: string | null
      },
): Promise<CheckoutAppOffers> {
  const data = await apiFetch<Record<string, unknown>>("/api/mobile/app-offers/checkout", {
    method: "POST",
    body: input,
  })
  const offers = Array.isArray(data.offers)
    ? data.offers.map(mapCheckoutOffer).filter((offer): offer is CheckoutAppOffer => offer != null)
    : []
  return {
    offers,
    autoApplied: mapCheckoutOffer(data.autoApplied),
    typed: mapCheckoutOffer(data.typed),
    typedError: str(data.typedError) || null,
  }
}

/** "Valid till 31 Dec" or null. */
export function appOfferValidity(endsOn: string | null) {
  if (!endsOn) return null
  const date = new Date(`${endsOn}T00:00:00+05:30`)
  if (Number.isNaN(date.getTime())) return null
  return `Valid till ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}`
}
