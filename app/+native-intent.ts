/**
 * Website links that open the app:
 *   https://glammzo.com/a/<slug>                     → /artist/<slug>
 *   https://glammzo.com/a/<slug>/book?services=…     → /artist/book/<slug>?serviceIds=…
 *   https://glammzo.com/a/<slug>?book=1&services=…   → /artist/book/<slug>?serviceIds=…
 *   https://glammzo.com/salons/<id>                  → /salon/<id>
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
