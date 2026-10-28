import { apiFetch } from "@/lib/api"

export type GlammzoOfferCard = {
  id: string
  title: string
  subtitle: string
  description: string
  eyebrow: string
  promoCode: string | null
  cashbackRupees: number
  minOrderRupees: number
  mobileBannerUrl: string | null
  ctaLabel: string | null
  ctaHref: string | null
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
    minOrderRupees:
      typeof o.minOrderRupees === "number" ? Math.max(0, Math.round(o.minOrderRupees)) : 0,
    mobileBannerUrl:
      typeof o.mobileBannerUrl === "string" && o.mobileBannerUrl.trim()
        ? o.mobileBannerUrl.trim()
        : null,
    ctaLabel: typeof o.ctaLabel === "string" && o.ctaLabel.trim() ? o.ctaLabel.trim() : null,
    ctaHref: typeof o.ctaHref === "string" && o.ctaHref.trim() ? o.ctaHref.trim() : null,
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
