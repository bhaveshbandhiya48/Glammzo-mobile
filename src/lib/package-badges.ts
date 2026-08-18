export type PackageBadgeDisplay = {
  emoji: string
  label: string
}

const PACKAGE_BADGE_DEFS = {
  bestSeller: { emoji: "⭐", label: "Best Seller" },
  mostBooked: { emoji: "🔥", label: "Most Booked" },
  premium: { emoji: "💎", label: "Premium" },
  bestValue: { emoji: "💰", label: "Best Value" },
  bridalSpecial: { emoji: "🎉", label: "Bridal Special" },
  new: { emoji: "🆕", label: "New" },
  festiveOffer: { emoji: "🎊", label: "Festive Offer" },
  limitedTime: { emoji: "⏳", label: "Limited Time" },
  staffPick: { emoji: "⭐", label: "Staff Pick" },
} as const

/** CRM badge slug → display (matches Glammzo-web catalog-utils). */
const CRM_BADGE_MAP: Record<string, PackageBadgeDisplay> = {
  best_seller: PACKAGE_BADGE_DEFS.bestSeller,
  most_booked: PACKAGE_BADGE_DEFS.mostBooked,
  bridal_special: PACKAGE_BADGE_DEFS.bridalSpecial,
  festive_offer: PACKAGE_BADGE_DEFS.festiveOffer,
  premium: PACKAGE_BADGE_DEFS.premium,
  limited_time: PACKAGE_BADGE_DEFS.limitedTime,
  new: PACKAGE_BADGE_DEFS.new,
  staff_pick: PACKAGE_BADGE_DEFS.staffPick,
  best_value: PACKAGE_BADGE_DEFS.bestValue,
}

function humanizeBadgeSlug(value: string): string {
  return value
    .trim()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/** Resolve CRM package badge slug to emoji + label (web parity). */
export function resolvePackageBadge(
  badge: string | null | undefined,
): PackageBadgeDisplay | undefined {
  const key = badge?.trim().toLowerCase()
  if (!key) return undefined
  return CRM_BADGE_MAP[key] ?? { emoji: "✨", label: humanizeBadgeSlug(key) }
}
