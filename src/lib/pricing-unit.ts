export const NAIL_PRICING_UNITS = [
  "both_hands",
  "per_hand",
  "per_finger",
] as const

export type NailPricingUnit = (typeof NAIL_PRICING_UNITS)[number]

const SHORT_LABEL: Record<NailPricingUnit, string> = {
  both_hands: "both hands",
  per_hand: "hand",
  per_finger: "finger",
}

const QTY_NOUN: Record<NailPricingUnit, { one: string; many: string; heading: string }> = {
  both_hands: { one: "set", many: "sets", heading: "Sets" },
  per_hand: { one: "hand", many: "hands", heading: "Hands" },
  per_finger: { one: "finger", many: "fingers", heading: "Fingers" },
}

export function parsePricingUnit(value: unknown): NailPricingUnit | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return NAIL_PRICING_UNITS.includes(trimmed as NailPricingUnit)
    ? (trimmed as NailPricingUnit)
    : null
}

export function maxQuantityForPricingUnit(unit: NailPricingUnit | null | undefined) {
  if (unit === "per_finger") return 10
  if (unit === "per_hand") return 2
  if (unit === "both_hands") return 1
  return null
}

export function pricingUnitUsesQuantity(unit: NailPricingUnit | null | undefined) {
  return unit === "per_finger" || unit === "per_hand"
}

export function clampPricingUnitQuantity(
  unit: NailPricingUnit | null | undefined,
  quantity: number,
) {
  const parsed = Number.isFinite(quantity) ? Math.floor(quantity) : 1
  const min = 1
  const max = maxQuantityForPricingUnit(unit)
  const next = Math.max(min, parsed)
  return max == null ? next : Math.min(max, next)
}

export function quantityForService(
  service: { id: string; pricingUnit?: string | null },
  quantities?: Record<string, number> | null,
) {
  const unit = parsePricingUnit(service.pricingUnit)
  if (!pricingUnitUsesQuantity(unit)) return 1
  return clampPricingUnitQuantity(unit, quantities?.[service.id] ?? 1)
}

export function pricingUnitQuantityLabel(unit: NailPricingUnit | null | undefined) {
  if (!unit) return "Qty"
  return QTY_NOUN[unit].heading
}

export function formatPricingUnitQuantityCaption(
  unit: NailPricingUnit | null | undefined,
  quantity: number,
) {
  if (!pricingUnitUsesQuantity(unit) || quantity < 1) return null
  const noun = QTY_NOUN[unit!]
  return quantity === 1 ? `1 ${noun.one}` : `${quantity} ${noun.many}`
}

export function formatPriceWithUnit(formattedAmount: string, unit: NailPricingUnit | null) {
  if (!unit) return formattedAmount
  return `${formattedAmount} / ${SHORT_LABEL[unit]}`
}
