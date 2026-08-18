import type { SalonOffer } from "@/data/types"

export function formatOfferDiscountBadge(
  offer: Pick<SalonOffer, "discountType" | "discountValue">,
) {
  return offer.discountType === "percent"
    ? `${offer.discountValue}% OFF`
    : `₹${offer.discountValue} OFF`
}

export function isServiceEligibleForOffer(offer: SalonOffer, serviceId: string) {
  if (!offer.isActive) return false
  if (offer.appliesTo === "selected_services") {
    return (offer.serviceIds ?? []).includes(serviceId)
  }
  return true
}

export function bestOfferForService(
  offers: SalonOffer[],
  serviceId: string,
  servicePrice = 0,
) {
  const eligible = offers.filter((offer) => isServiceEligibleForOffer(offer, serviceId))
  if (eligible.length === 0) return null

  return [...eligible].sort((a, b) => {
    const aSave =
      a.discountType === "percent"
        ? (servicePrice * a.discountValue) / 100
        : a.discountValue
    const bSave =
      b.discountType === "percent"
        ? (servicePrice * b.discountValue) / 100
        : b.discountValue
    return bSave - aSave
  })[0] ?? null
}
