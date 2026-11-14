import type { ArtistCategoryId } from "@/lib/service-tiles"

/** Get quotes is hidden everywhere unless this flag is on. */
export function isGetQuotesEnabled() {
  return process.env.EXPO_PUBLIC_GET_QUOTES_ENABLED === "true"
}

/**
 * Must match the CRM's ARTIST_CATEGORY_IDS and ARTIST_OCCASION_IDS (glamzzo-crm
 * src/lib/artist/categories.ts): the server rejects any other id.
 */
export const QUOTE_CATEGORIES: { id: ArtistCategoryId; label: string }[] = [
  { id: "makeup", label: "Makeup" },
  { id: "hair", label: "Hair" },
  { id: "nails", label: "Nails" },
  { id: "mehendi", label: "Mehendi" },
  { id: "skin", label: "Skin & facial" },
  { id: "lashes", label: "Lashes & brows" },
  { id: "spa", label: "Spa & massage" },
  { id: "waxing", label: "Waxing & grooming" },
  { id: "bridal", label: "Bridal packages" },
  { id: "mens", label: "Men's grooming" },
  { id: "other", label: "Other" },
]

export type QuoteOccasionId = "bridal" | "engagement" | "party" | "pre_wedding" | "daily"

export const QUOTE_OCCASIONS: { id: QuoteOccasionId; label: string }[] = [
  { id: "bridal", label: "Bridal" },
  { id: "engagement", label: "Engagement" },
  { id: "party", label: "Party" },
  { id: "pre_wedding", label: "Pre-wedding shoot" },
  { id: "daily", label: "Everyday" },
]

/** Quotes a request can collect (matches the CRM cap). */
export const MAX_QUOTES = 5

export function isQuoteCategory(value: unknown): value is ArtistCategoryId {
  return typeof value === "string" && QUOTE_CATEGORIES.some((c) => c.id === value)
}

export function quoteCategoryLabel(id: string) {
  return QUOTE_CATEGORIES.find((c) => c.id === id)?.label ?? id
}

export function quoteOccasionLabel(id: string | null | undefined) {
  if (!id) return null
  return QUOTE_OCCASIONS.find((o) => o.id === id)?.label ?? id
}

/** "Bridal makeup", "Party · Hair", or just the category. */
export function requestTitle(category: string, occasion: string | null | undefined) {
  const cat = quoteCategoryLabel(category)
  const occ = quoteOccasionLabel(occasion)
  if (!occ) return cat
  return `${occ} · ${cat}`
}

/** "Sat, 21 Nov" from YYYY-MM-DD (noon local avoids day shifts). */
export function formatEventDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

export function peopleLabel(people: number) {
  return `${people} ${people === 1 ? "person" : "people"}`
}

/** Whole days left until the request closes (at least 1 while open). */
export function daysLeft(expiresAt: string, now = Date.now()) {
  const ms = Date.parse(expiresAt) - now
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.max(1, Math.ceil(ms / 86_400_000))
}

export function staysOpenLabel(expiresAt: string) {
  const d = daysLeft(expiresAt)
  return `stays open ${d} more ${d === 1 ? "day" : "days"}`
}
