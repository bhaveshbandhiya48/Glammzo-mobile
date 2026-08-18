import type { Salon } from "@/data/types"

/** Used only when the catalog has too little service data. */
export const FALLBACK_POPULAR_SEARCHES = [
  "Haircut",
  "Facial",
  "Gel nails",
  "Bridal makeup",
  "Spa massage",
  "Barber",
] as const

/** @deprecated Prefer getPopularSearches(salons). */
export const POPULAR_SEARCHES = FALLBACK_POPULAR_SEARCHES

export const SEARCH_CATEGORIES = [
  { id: "hair", label: "Hair", keywords: ["hair", "haircut", "color", "blowout", "styling"] },
  { id: "spa", label: "Spa", keywords: ["spa", "facial", "massage", "aromatherapy"] },
  { id: "nails", label: "Nails", keywords: ["nails", "manicure", "pedicure", "gel"] },
  { id: "makeup", label: "Makeup", keywords: ["makeup", "bridal", "party", "glam"] },
  { id: "grooming", label: "Grooming", keywords: ["grooming", "beard", "brow", "barber"] },
] as const

export type ServiceSuggestion = {
  id: string
  name: string
  salonName: string
  salonId: string
  category: string
  price: number
}

export type SearchSuggestions = {
  salons: Salon[]
  services: ServiceSuggestion[]
  categories: (typeof SEARCH_CATEGORIES)[number][]
}

/**
 * Rank popular search terms from nearby/catalog salons:
 * service categories (strongest) and shared service names.
 */
export function getPopularSearches(salons: Salon[], limit = 6): string[] {
  const counts = new Map<string, { label: string; count: number }>()

  function bump(raw: string | null | undefined, weight: number) {
    const label = raw?.trim()
    if (!label || label.length < 3) return
    // Skip very long one-off package names from dominating the list.
    if (label.length > 32) return
    const key = label.toLowerCase()
    // Skip generic business-type noise.
    if (key === "salon" || key === "other") return
    const prev = counts.get(key)
    if (prev) {
      prev.count += weight
      return
    }
    counts.set(key, { label, count: weight })
  }

  for (const salon of salons) {
    for (const svc of salon.services) {
      bump(svc.category, 4)
      bump(svc.name, 1)
    }
  }

  return [...counts.values()]
    .filter((item) => item.count >= 2 || salons.length < 3)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((item) => item.label)
    .slice(0, limit)
}

export function salonMatchesQuery(salon: Salon, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    salon.name.toLowerCase().includes(q) ||
    salon.area.toLowerCase().includes(q) ||
    salon.city.toLowerCase().includes(q) ||
    salon.businessType?.toLowerCase().includes(q) === true ||
    salon.shortDescription.toLowerCase().includes(q) ||
    salon.services.some(
      (svc) =>
        svc.name.toLowerCase().includes(q) || svc.category.toLowerCase().includes(q),
    )
  )
}

export function getSearchSuggestions(salons: Salon[], query: string): SearchSuggestions {
  const q = query.trim().toLowerCase()
  if (!q) {
    return { salons: [], services: [], categories: [] }
  }

  const matchedSalons = salons.filter((salon) => salonMatchesQuery(salon, q)).slice(0, 5)

  const services: ServiceSuggestion[] = []
  const seenServiceKeys = new Set<string>()
  for (const salon of salons) {
    for (const svc of salon.services) {
      if (
        svc.name.toLowerCase().includes(q) ||
        svc.category.toLowerCase().includes(q)
      ) {
        const key = `${salon.id}:${svc.id || svc.name}:${svc.price}`
        if (seenServiceKeys.has(key)) continue
        seenServiceKeys.add(key)
        services.push({
          id: svc.id || key,
          name: svc.name,
          salonName: salon.name,
          salonId: salon.id,
          category: svc.category,
          price: svc.price,
        })
      }
      if (services.length >= 5) break
    }
    if (services.length >= 5) break
  }

  const categories = SEARCH_CATEGORIES.filter(
    (cat) =>
      cat.label.toLowerCase().includes(q) ||
      cat.id.includes(q) ||
      cat.keywords.some((kw) => kw.includes(q) || q.includes(kw)),
  ).slice(0, 3)

  return {
    salons: matchedSalons,
    services,
    categories,
  }
}
