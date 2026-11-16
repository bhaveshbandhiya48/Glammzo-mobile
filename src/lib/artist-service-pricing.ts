/**
 * Several prices on one artist service, and per finger / per hand pricing for Nails and Mehendi.
 * Keep in sync with glamzzo-crm `src/lib/artist/service-pricing.ts`, the source of truth:
 * the CRM re-prices every booking, this file only shows totals before booking.
 */
import type { PublicArtistService } from "@/lib/artists-api"
import { formatRupees } from "@/lib/service-pricing"

export type ArtistPricingUnit = "per_finger" | "per_hand"
export type ArtistServiceChoice = { serviceId: string; priceOptionId?: string | null; quantity?: number | null }

export const MAX_ARTIST_QUANTITY: Record<ArtistPricingUnit, number> = { per_finger: 10, per_hand: 2 }
const UNIT_CATEGORIES = ["nails", "mehendi"]
const NOUN: Record<ArtistPricingUnit, { one: string; many: string }> = {
  per_finger: { one: "finger", many: "fingers" },
  per_hand: { one: "hand", many: "hands" },
}

export function artistServiceOptions(service: PublicArtistService) {
  const list = Array.isArray(service.priceOptions) ? service.priceOptions : []
  return list.length >= 2 ? list : []
}

export function artistServiceUnit(service: PublicArtistService): ArtistPricingUnit | null {
  const unit = service.pricingUnit
  if ((unit === "per_finger" || unit === "per_hand") && UNIT_CATEGORIES.includes(service.category ?? "")) return unit
  return null
}

export function artistMinQuantity(service: PublicArtistService) {
  const unit = artistServiceUnit(service)
  if (!unit) return 1
  return Math.min(MAX_ARTIST_QUANTITY[unit], Math.max(1, service.minQuantity ?? 1))
}

export function artistQuantityLabel(unit: ArtistPricingUnit, quantity: number) {
  return `${quantity} ${quantity === 1 ? NOUN[unit].one : NOUN[unit].many}`
}

export function artistUnitSuffix(unit: ArtistPricingUnit) {
  return `/ ${NOUN[unit].one}`
}

export function artistServiceHasChoices(service: PublicArtistService) {
  return artistServiceOptions(service).length > 0 || artistServiceUnit(service) !== null
}

/** Default: cheapest option, both hands (10 fingers / 2 hands). */
export function defaultArtistChoice(service: PublicArtistService): ArtistServiceChoice {
  const options = artistServiceOptions(service)
  const cheapest = options.length > 0 ? options.reduce((low, o) => (o.price < low.price ? o : low), options[0]!) : null
  const unit = artistServiceUnit(service)
  return { serviceId: service.id, priceOptionId: cheapest?.id ?? null, quantity: unit ? MAX_ARTIST_QUANTITY[unit] : null }
}

export function artistPriceLine(service: PublicArtistService, choice?: ArtistServiceChoice | null, basePrice = service.price) {
  const option = artistServiceOptions(service).find((o) => o.id === choice?.priceOptionId) ?? null
  const unit = artistServiceUnit(service)
  const min = artistMinQuantity(service)
  const quantity = unit ? Math.min(MAX_ARTIST_QUANTITY[unit], Math.max(min, choice?.quantity ?? min)) : 1
  const unitPrice = option ? option.price : basePrice
  const detail = [option?.name, unit ? artistQuantityLabel(unit, quantity) : null].filter(Boolean).join(" × ")
  return {
    option,
    unit,
    quantity,
    unitPrice,
    total: Math.round(unitPrice * quantity * 100) / 100,
    durationMinutes: option ? option.durationMinutes : service.durationMinutes,
    detail,
  }
}

/** "₹300", "From ₹300", "₹50 / finger". */
export function artistPriceLabel(service: PublicArtistService, basePrice = service.price) {
  const options = artistServiceOptions(service)
  const unit = artistServiceUnit(service)
  const low = options.length > 0 ? Math.min(...options.map((o) => o.price)) : basePrice
  const text = `${options.length > 0 ? "From " : ""}${formatRupees(low)}`
  return unit ? `${text} ${artistUnitSuffix(unit)}` : text
}

/** `svc:option:qty,…` for the slots query. */
export function serializeArtistChoices(choices: ArtistServiceChoice[]) {
  return choices
    .filter((c) => c.priceOptionId || c.quantity)
    .map((c) => `${c.serviceId}:${c.priceOptionId ?? ""}:${c.quantity ?? ""}`)
    .join(",")
}
