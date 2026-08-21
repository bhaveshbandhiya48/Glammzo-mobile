import type { IconName } from "@/components/ui/Icon"

/**
 * CRM signup `settings.businessType` options — keep in sync with
 * Glammzo-web `lib/categories/business-types.ts` / glamzzo-crm.
 */
export const BUSINESS_TYPES = [
  "Salon",
  "Unisex Salon",
  "Beauty Parlour",
  "Spa",
  "Nail Art Studio",
  "Yoga Center",
] as const

export type BusinessType = (typeof BUSINESS_TYPES)[number]

export type BusinessTypeItem = {
  label: BusinessType
  icon: IconName
}

export const BUSINESS_TYPE_ITEMS: BusinessTypeItem[] = [
  { label: "Salon", icon: "cut-outline" },
  { label: "Unisex Salon", icon: "people-outline" },
  { label: "Beauty Parlour", icon: "sparkles-outline" },
  { label: "Spa", icon: "leaf-outline" },
  { label: "Nail Art Studio", icon: "hand-left-outline" },
  { label: "Yoga Center", icon: "body-outline" },
]

export function isBusinessType(value: string): value is BusinessType {
  return (BUSINESS_TYPES as readonly string[]).includes(value)
}

/** Count salons per known business type (exact CRM label match). */
export function countSalonsByBusinessType(
  salons: Array<{ businessType?: string }>,
): Map<BusinessType, number> {
  const counts = new Map<BusinessType, number>()
  for (const type of BUSINESS_TYPES) counts.set(type, 0)
  for (const salon of salons) {
    const type = salon.businessType?.trim()
    if (!type || !isBusinessType(type)) continue
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return counts
}
