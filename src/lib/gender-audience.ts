import type { Salon, SalonPackage, SalonService } from "@/data/types"

export const SERVICE_GENDER_AUDIENCES = ["men", "women"] as const
export type ServiceGenderAudience = (typeof SERVICE_GENDER_AUDIENCES)[number]

export const SERVICE_GENDER_AUDIENCE_LABELS: Record<ServiceGenderAudience, string> = {
  men: "Men",
  women: "Women's",
}

export function serviceGenderLabel(
  genderAudience: ServiceGenderAudience | null | undefined,
) {
  if (!genderAudience) return null
  return SERVICE_GENDER_AUDIENCE_LABELS[genderAudience]
}

function normalizeBusinessType(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase()
}

export function isUnisexSalonBusiness(value: string | null | undefined) {
  return normalizeBusinessType(value) === "unisex salon"
}

export function parseServiceGenderAudience(value: unknown): ServiceGenderAudience | null {
  if (value === "men" || value === "women") return value
  return null
}

export function parsePackageGenderAudience(
  value: unknown,
): ServiceGenderAudience | "unisex" | null {
  if (value === "men" || value === "women" || value === "unisex") return value
  return null
}

export function serviceMatchesGenderAudience(
  genderAudience: ServiceGenderAudience | null | undefined,
  selected: ServiceGenderAudience,
) {
  if (!genderAudience) return true
  return genderAudience === selected
}

export function filterServicesByGenderAudience(
  services: SalonService[],
  selected: ServiceGenderAudience,
) {
  return services.filter((service) =>
    serviceMatchesGenderAudience(service.genderAudience, selected),
  )
}

export function filterPackagesByGenderAudience(
  packages: SalonPackage[],
  services: SalonService[],
  selected: ServiceGenderAudience,
) {
  const byId = new Map(services.map((service) => [service.id, service]))
  return packages.filter((pkg) => {
    if (pkg.genderAudience === "unisex") return true
    if (pkg.genderAudience === "men" || pkg.genderAudience === "women") {
      return pkg.genderAudience === selected
    }
    const catalogItems = pkg.items.filter((item) => item.serviceId)
    if (catalogItems.length === 0) return true
    return catalogItems.some((item) =>
      serviceMatchesGenderAudience(byId.get(item.serviceId)?.genderAudience, selected),
    )
  })
}

/** Business types whose customers are women (no men's menu). */
const WOMEN_ONLY_BUSINESS_TYPES = new Set(["beauty parlour", "nail art studio"])

/**
 * Whether a salon belongs under the Women or Men switch (same rule as Glammzo-web).
 * The salon's own Men / Women / Unisex choice wins when set. Otherwise unisex salons count
 * when at least one service is for that audience, parlours and nail studios are for women,
 * and every other type shows for both.
 */
export function salonMatchesGenderAudience(
  salon: Pick<Salon, "businessType" | "salonAudience" | "services">,
  selected: ServiceGenderAudience,
) {
  if (salon.salonAudience === "unisex") return true
  if (salon.salonAudience === "men" || salon.salonAudience === "women") return salon.salonAudience === selected
  const type = normalizeBusinessType(salon.businessType)
  if (WOMEN_ONLY_BUSINESS_TYPES.has(type)) return selected === "women"
  if (isUnisexSalonBusiness(type)) {
    if (salon.services.length === 0) return true
    return salon.services.some((service) => serviceMatchesGenderAudience(service.genderAudience, selected))
  }
  return true
}
