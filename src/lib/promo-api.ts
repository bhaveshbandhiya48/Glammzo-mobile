import { apiFetch } from "@/lib/api"

export type AppliedOfferDiscount = {
  offerId: string
  code: string
  title: string
  discountType: "percent" | "fixed"
  discountValue: number
  subtotal: number
  discountAmount: number
  finalTotal: number
}

export type ValidatePromoResult = { kind: "discount"; discount: AppliedOfferDiscount }

export async function validatePromoCode(input: {
  salonId: string
  code: string
  serviceIds: string[]
  packageId?: string | null
  serviceQuantities?: Record<string, number>
  servicePriceOptionIds?: Record<string, string>
}): Promise<ValidatePromoResult> {
  const data = await apiFetch<{
    ok: boolean
    kind?: string
    discount?: AppliedOfferDiscount
  }>("/api/mobile/promo/validate", {
    method: "POST",
    body: {
      salonId: input.salonId,
      code: input.code,
      serviceIds: input.serviceIds,
      packageId: input.packageId ?? null,
      serviceQuantities: input.serviceQuantities,
      servicePriceOptionIds: input.servicePriceOptionIds,
    },
  })

  return parsePromoValidateResponse(data)
}

/** Artist checkout codes (instant discount). Glammzo offer codes go through app-offers-api. */
export async function validateArtistPromoCode(input: {
  code: string
  subtotal: number
  artistSlug: string
  serviceIds: string[]
}): Promise<ValidatePromoResult> {
  const data = await apiFetch<{
    ok: boolean
    kind?: string
    discount?: AppliedOfferDiscount
  }>("/api/mobile/promo/validate", {
    method: "POST",
    body: {
      scope: "artist",
      code: input.code,
      subtotal: input.subtotal,
      artistSlug: input.artistSlug,
      serviceIds: input.serviceIds,
    },
  })

  return parsePromoValidateResponse(data)
}

function parsePromoValidateResponse(data: { kind?: string; discount?: AppliedOfferDiscount }): ValidatePromoResult {
  if (data.kind === "discount" && data.discount) {
    return { kind: "discount", discount: data.discount }
  }
  throw new Error("Unexpected promo validation response.")
}
