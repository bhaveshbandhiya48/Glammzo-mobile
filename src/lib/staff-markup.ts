import type { SalonService } from "@/data/types"
import { quantityForService } from "@/lib/pricing-unit"

/**
 * Staff levels (Pro salons): picking a professional with a level prices each service with their
 * markup. "Any available" and packages keep normal prices. Mirrors Glammzo-web
 * `src/lib/salons/staff-markup.ts`, which the server uses to price the booking.
 *
 * - percent: each unit price goes up by the percent, rounded to the rupee.
 * - fixed: the amount is added once per service line (spread over per-finger / per-hand units).
 */
export type StaffLevelMarkup = {
  levelName: string
  type: "percent" | "fixed"
  value: number
}

export function hasStaffMarkup(markup: StaffLevelMarkup | null | undefined): markup is StaffLevelMarkup {
  return Boolean(markup && markup.value > 0)
}

export function parseStaffMarkup(value: unknown): StaffLevelMarkup | null {
  if (!value || typeof value !== "object") return null
  const row = value as { levelName?: unknown; type?: unknown; value?: unknown }
  const amount = Number(row.value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return {
    levelName: typeof row.levelName === "string" && row.levelName.trim() ? row.levelName.trim() : "Senior",
    type: row.type === "fixed" ? "fixed" : "percent",
    value: amount,
  }
}

export function markupUnitPrice(
  unitPrice: number,
  quantity: number,
  markup: StaffLevelMarkup | null | undefined,
) {
  if (!hasStaffMarkup(markup) || !(unitPrice > 0)) return unitPrice
  if (markup.type === "percent") {
    return Math.round(unitPrice * (1 + markup.value / 100))
  }
  const units = Math.max(1, Math.floor(quantity) || 1)
  return Math.round((unitPrice + markup.value / units) * 100) / 100
}

/** "+20%" / "+₹200". */
export function formatStaffMarkup(markup: StaffLevelMarkup | null | undefined) {
  if (!hasStaffMarkup(markup)) return ""
  return markup.type === "percent"
    ? `+${markup.value}%`
    : `+₹${markup.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

/** Services priced for this professional. Same array back when there is no markup. */
export function servicesWithStaffMarkup(
  services: SalonService[],
  markup: StaffLevelMarkup | null | undefined,
  quantities?: Record<string, number> | null,
): SalonService[] {
  if (!hasStaffMarkup(markup)) return services
  return services.map((service) => {
    const quantity = quantityForService(service, quantities)
    return {
      ...service,
      price: markupUnitPrice(service.price, quantity, markup),
      ...(service.compareAtPrice != null
        ? { compareAtPrice: markupUnitPrice(service.compareAtPrice, quantity, markup) }
        : {}),
      ...(service.priceOptions
        ? {
            priceOptions: service.priceOptions.map((option) => ({
              ...option,
              price: markupUnitPrice(option.price, quantity, markup),
            })),
          }
        : {}),
    }
  })
}
