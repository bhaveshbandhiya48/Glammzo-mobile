export const ARTIST_CART_PREFIX = "artist:"

export function artistCartId(slug: string) {
  return `${ARTIST_CART_PREFIX}${slug.trim().toLowerCase()}`
}

export function isArtistCartId(id: string) {
  return id.startsWith(ARTIST_CART_PREFIX)
}

export function artistSlugFromCartId(id: string) {
  if (!isArtistCartId(id)) return null
  const slug = id.slice(ARTIST_CART_PREFIX.length).trim().toLowerCase()
  return slug || null
}
