/**
 * Shared artist links are https://glammzo.com/a/<slug>.
 * The app's page for that artist is /artist/<slug>.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const target = artistLinkPath(path)
    return target ?? path
  } catch {
    return path
  }
}

export function artistLinkPath(incoming: string): string | null {
  const url = new URL(incoming, "https://glammzo.com")
  const host = url.hostname.toLowerCase()
  if (host !== "glammzo.com" && host !== "www.glammzo.com") return null

  const parts = url.pathname.split("/").filter(Boolean)
  if (parts[0] !== "a" || !parts[1]) return null

  const slug = encodeURIComponent(decodeURIComponent(parts[1]))
  const search = url.search
  if (parts[2] === "book") return `/artist/book/${slug}${search}`
  return `/artist/${slug}${search}`
}
