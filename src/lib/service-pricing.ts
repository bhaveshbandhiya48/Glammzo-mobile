import type { SalonPackage, SalonService } from "@/data/types"
import {
  formatPriceWithUnit,
  formatPricingUnitQuantityCaption,
  parsePricingUnit,
  quantityForService,
} from "@/lib/pricing-unit"

export function serviceHasPriceOptions(
  service: Pick<SalonService, "priceOptions"> | null | undefined,
) {
  return (service?.priceOptions?.length ?? 0) >= 2
}

export function defaultPriceOptionId(
  service: Pick<SalonService, "priceOptions"> | null | undefined,
) {
  if (!serviceHasPriceOptions(service)) return null
  return service!.priceOptions![0]!.id
}

export function resolveServiceOptionPrice(
  service: Pick<SalonService, "price" | "priceOptions">,
  optionId?: string | null,
) {
  const selected = service.priceOptions?.find((option) => option.id === optionId)
  if (selected) return selected.price
  const fallbackId = defaultPriceOptionId(service)
  const fallback = fallbackId
    ? service.priceOptions?.find((option) => option.id === fallbackId)
    : undefined
  return fallback?.price ?? service.price
}

export function serviceLineAmount(
  service: Pick<SalonService, "id" | "price" | "priceOptions" | "pricingUnit">,
  quantities?: Record<string, number> | null,
  optionId?: string | null,
) {
  return resolveServiceOptionPrice(service, optionId) * quantityForService(service, quantities)
}

export function cartServicesSubtotal(
  services: SalonService[],
  selectedServiceIds: string[],
  selectedPackage?: SalonPackage | null,
  quantities?: Record<string, number> | null,
  priceOptionIds?: Record<string, string> | null,
) {
  const byId = new Map(services.map((service) => [service.id, service]))
  const lineAmount = (serviceId: string) => {
    const service = byId.get(serviceId)
    if (!service) return 0
    return serviceLineAmount(service, quantities, priceOptionIds?.[serviceId])
  }

  if (selectedPackage) {
    const packageServiceIds = new Set(
      selectedPackage.items.map((item) => item.serviceId).filter(Boolean),
    )
    const extrasTotal = selectedServiceIds
      .filter((serviceId) => !packageServiceIds.has(serviceId))
      .reduce((sum, serviceId) => sum + lineAmount(serviceId), 0)
    return selectedPackage.packagePrice + extrasTotal
  }

  return selectedServiceIds.reduce((sum, serviceId) => sum + lineAmount(serviceId), 0)
}

/** "★ 4.8", or "New" for a place with no reviews yet (never "★ 0.0"). */
export function formatRatingLabel(rating: number | null | undefined, reviews?: number | null) {
  if (!rating || rating <= 0 || reviews === 0) return "New"
  return `★ ${rating.toFixed(1)}`
}

/** ₹ with Indian grouping (₹15,000); paise only when the amount has them (₹682.50). */
export function formatRupees(amount: number) {
  const paise = Math.round(amount * 100)
  const whole = paise % 100 === 0
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`
}

export function formatServicePriceLabel(
  service: Pick<SalonService, "price" | "priceOptions" | "pricingUnit">,
  optionId?: string | null,
  opts?: { finalPrice?: boolean },
) {
  const hasOptions = serviceHasPriceOptions(service)
  const selected = service.priceOptions?.find((option) => option.id === optionId)
  const amount =
    selected?.price ??
    (opts?.finalPrice
      ? resolveServiceOptionPrice(service, optionId)
      : service.price)
  const formatted = formatPriceWithUnit(formatRupees(amount), parsePricingUnit(service.pricingUnit))
  const onwards = !opts?.finalPrice && hasOptions && !selected
  return onwards ? `${formatted} onwards` : formatted
}

export function selectedOptionName(
  service: Pick<SalonService, "priceOptions">,
  optionId?: string | null,
) {
  if (!optionId) return null
  return service.priceOptions?.find((option) => option.id === optionId)?.name ?? null
}

export function serviceCartCaption(
  service: Pick<
    SalonService,
    "id" | "category" | "durationMin" | "pricingUnit" | "priceOptions"
  >,
  quantities?: Record<string, number> | null,
  optionId?: string | null,
) {
  const quantity = quantityForService(service, quantities)
  const unit = parsePricingUnit(service.pricingUnit)
  const qtyCaption = formatPricingUnitQuantityCaption(unit, quantity)
  const optionName = selectedOptionName(service, optionId)
  const duration = service.durationMin * quantity
  return [service.category, qtyCaption, `${duration} min`, optionName]
    .filter(Boolean)
    .join(" · ")
}
