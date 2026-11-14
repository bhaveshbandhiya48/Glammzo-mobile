import { apiFetch } from "@/lib/api"

export type GlammzoOfferCard = {
  id: string
  title: string
  subtitle: string
  description: string
  eyebrow: string
  promoCode: string | null
  /** Fixed cashback, or the cap for % offers. */
  cashbackRupees: number
  /** % offers: cashback is this % of the booking, up to cashbackRupees. */
  cashbackPercent: number | null
  /** Applied at checkout without a code. */
  autoApply: boolean
  /** cashback = wallet credit after the visit; instant = off the bill at checkout. */
  benefitType: "cashback" | "instant"
  minOrderRupees: number
  mobileBannerUrl: string | null
  ctaLabel: string | null
  ctaHref: string | null
  /** Banner tap target: an app route (/salon/<id>, /artist/<slug>, /category/<type>) or https URL. */
  mobileHref: string | null
}

function mapOffer(raw: unknown): GlammzoOfferCard | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === "string" ? o.id : ""
  const title = typeof o.title === "string" ? o.title : ""
  if (!id || !title) return null
  return {
    id,
    title,
    subtitle: typeof o.subtitle === "string" ? o.subtitle : "",
    description: typeof o.description === "string" ? o.description : "",
    eyebrow: typeof o.eyebrow === "string" && o.eyebrow.trim() ? o.eyebrow : "Glammzo offer",
    promoCode:
      typeof o.promoCode === "string" && o.promoCode.trim()
        ? o.promoCode.trim().toUpperCase()
        : null,
    cashbackRupees:
      typeof o.cashbackRupees === "number" ? Math.max(0, Math.round(o.cashbackRupees)) : 0,
    cashbackPercent:
      typeof o.cashbackPercent === "number" && o.cashbackPercent > 0
        ? Math.round(o.cashbackPercent)
        : null,
    autoApply: o.autoApply === true,
    benefitType: o.benefitType === "instant" ? "instant" : "cashback",
    minOrderRupees:
      typeof o.minOrderRupees === "number" ? Math.max(0, Math.round(o.minOrderRupees)) : 0,
    mobileBannerUrl:
      typeof o.mobileBannerUrl === "string" && o.mobileBannerUrl.trim()
        ? o.mobileBannerUrl.trim()
        : null,
    ctaLabel: typeof o.ctaLabel === "string" && o.ctaLabel.trim() ? o.ctaLabel.trim() : null,
    ctaHref: typeof o.ctaHref === "string" && o.ctaHref.trim() ? o.ctaHref.trim() : null,
    mobileHref:
      typeof o.mobileHref === "string" && /^(\/[^/]|https:\/\/)/.test(o.mobileHref.trim())
        ? o.mobileHref.trim()
        : null,
  }
}

async function fetchOffers(input: {
  city?: string | null
  area?: string | null
  placement: "salon" | "banner"
}): Promise<GlammzoOfferCard[]> {
  const params = new URLSearchParams()
  params.set("placement", input.placement)
  if (input.city?.trim()) params.set("city", input.city.trim())
  if (input.area?.trim()) params.set("area", input.area.trim())
  const data = await apiFetch<{ offers?: unknown }>(
    `/api/mobile/offers?${params.toString()}`,
    { auth: false },
  )
  return Array.isArray(data.offers)
    ? data.offers.map(mapOffer).filter((o): o is GlammzoOfferCard => o != null)
    : []
}

/** Salon-detail Glammzo offers for this location (CMS only). */
export async function fetchGlammzoOffersForSalon(input: {
  city?: string | null
  area?: string | null
}): Promise<GlammzoOfferCard[]> {
  try {
    return await fetchOffers({ ...input, placement: "salon" })
  } catch {
    return []
  }
}

/** Same CMS cashback offers, shown simply on solo-artist detail. */
export async function fetchGlammzoOffersForArtist(input: {
  city?: string | null
  area?: string | null
}): Promise<GlammzoOfferCard[]> {
  return fetchGlammzoOffersForSalon(input)
}

/** Explore homepage offer banners for this location (CMS only). */
export async function fetchGlammzoOfferBanners(input: {
  city?: string | null
  area?: string | null
}): Promise<GlammzoOfferCard[]> {
  try {
    return await fetchOffers({ ...input, placement: "banner" })
  } catch {
    return []
  }
}

/** Short text such as "₹200 cashback" or "20% cashback up to ₹200". */
export function offerCashbackText(
  offer: Pick<GlammzoOfferCard, "cashbackRupees" | "cashbackPercent"> &
    Partial<Pick<GlammzoOfferCard, "benefitType">>,
) {
  const word = offer.benefitType === "instant" ? "off" : "cashback"
  return offer.cashbackPercent
    ? `${offer.cashbackPercent}% ${word} up to ₹${offer.cashbackRupees}`
    : `₹${offer.cashbackRupees} ${word}`
}

/** Offers already counted as viewed since the app started (one view per offer per launch). */
const viewedOfferIds = new Set<string>()

function sendOfferEvent(offerIds: string[], event: "view" | "click") {
  if (offerIds.length === 0) return
  void apiFetch("/api/offers/track", {
    method: "POST",
    auth: false,
    body: { offerIds: offerIds.slice(0, 20), event, surface: "mobile" },
    timeoutMs: 8_000,
  }).catch(() => undefined)
}

/** Counts a view for each offer banner shown (best effort). */
export function trackOfferViews(offerIds: string[]) {
  const fresh = offerIds.filter((id) => id && !viewedOfferIds.has(id))
  for (const id of fresh) viewedOfferIds.add(id)
  sendOfferEvent(fresh, "view")
}

/** Counts a tap on an offer banner (best effort). */
export function trackOfferClick(offerId: string) {
  if (offerId) sendOfferEvent([offerId], "click")
}
