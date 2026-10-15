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

export type PromoCashbackClaim = {
  code: string
  cashbackRupees: number
  message: string
}

export type ValidatePromoResult =
  | { kind: "discount"; discount: AppliedOfferDiscount }
  | { kind: "cashback"; cashback: PromoCashbackClaim }

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
    code?: string
    cashbackRupees?: number
    message?: string
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

  if (data.kind === "discount" && data.discount) {
    return { kind: "discount", discount: data.discount }
  }

  if (
    data.kind === "cashback" &&
    typeof data.code === "string" &&
    typeof data.cashbackRupees === "number" &&
    typeof data.message === "string"
  ) {
    return {
      kind: "cashback",
      cashback: {
        code: data.code,
        cashbackRupees: data.cashbackRupees,
        message: data.message,
      },
    }
  }

  throw new Error("Unexpected promo validation response.")
}
