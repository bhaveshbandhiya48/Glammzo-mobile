/**
 * Website links that open the app:
 *   https://glammzo.com/a/<slug>                     → /artist/<slug>
 *   https://glammzo.com/a/<slug>/book?services=…     → /artist/book/<slug>?serviceIds=…
 *   https://glammzo.com/a/<slug>?book=1&services=…   → /artist/book/<slug>?serviceIds=…
 *   https://glammzo.com/salons/<id>                  → /salon/<id>
 *   https://glammzo.com/book/<salonId>?services=…    → /book/<salonId>?serviceIds=…
 *     (also `serviceId`; `package` → `packageId`; promo, qty, opts kept; `error` dropped)
 *   https://glammzo.com/book/confirmation?id=…       → /book/confirmation?bookingId=…
 * www.glammzo.com works the same way.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const target = websiteLinkPath(path)
    return target ?? path
  } catch {
    return path
  }
}

export function websiteLinkPath(incoming: string): string | null {
  const url = new URL(incoming, "https://glammzo.com")
  const host = url.hostname.toLowerCase()
  if (host !== "glammzo.com" && host !== "www.glammzo.com") return null

  const parts = url.pathname.split("/").filter(Boolean)
  if (!parts[1]) return null
  const segment = encodeURIComponent(decodeURIComponent(parts[1]))

  if (parts[0] === "salons") return `/salon/${segment}${url.search}`
  if (parts[0] === "book") return salonBookingPath(parts[1], url.searchParams)
  if (parts[0] !== "a") return null

  // The website's booking param is `services`; the app's booking screen reads `serviceIds`.
  const bookPath = parts[2] === "book"
  const bookFlag = url.searchParams.get("book") === "1"
  if (bookPath || bookFlag) {
    const params = new URLSearchParams(url.searchParams)
    params.delete("book")
    const services = params.get("services")
    params.delete("services")
    if (services?.trim()) params.set("serviceIds", services.trim())
    const query = params.toString()
    return `/artist/book/${segment}${query ? `?${query}` : ""}`
  }
  return `/artist/${segment}${url.search}`
}

/** Website `/book/<salonId>` (and its confirmation page) → the app's salon booking screens. */
function salonBookingPath(rawSegment: string, search: URLSearchParams): string {
  const salonId = decodeURIComponent(rawSegment)
  if (salonId === "confirmation") {
    const id = search.get("id")?.trim()
    return id ? `/book/confirmation?bookingId=${encodeURIComponent(id)}` : "/bookings"
  }
  const params = new URLSearchParams(search)
  const services = (params.get("services") || params.get("serviceId") || "").trim()
  params.delete("services")
  params.delete("serviceId")
  params.delete("error")
  if (services) params.set("serviceIds", services)
  const packageId = params.get("package")?.trim()
  params.delete("package")
  if (packageId) params.set("packageId", packageId)
  const query = params.toString()
  return `/book/${encodeURIComponent(salonId)}${query ? `?${query}` : ""}`
}
