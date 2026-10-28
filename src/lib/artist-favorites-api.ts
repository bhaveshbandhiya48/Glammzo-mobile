import { apiFetch } from "@/lib/api"

export async function fetchFavoriteArtistSlugs(): Promise<string[]> {
  const data = await apiFetch<{ ok: boolean; artistSlugs: string[] }>(
    "/api/mobile/artist-favorites",
  )
  return Array.isArray(data.artistSlugs) ? data.artistSlugs : []
}

export async function toggleFavoriteArtist(
  artistSlug: string,
): Promise<{ favorited: boolean; artistSlugs: string[] }> {
  const data = await apiFetch<{
    ok: boolean
    favorited: boolean
    artistSlugs: string[]
  }>("/api/mobile/artist-favorites", {
    method: "POST",
    body: { artistSlug },
  })
  return {
    favorited: Boolean(data.favorited),
    artistSlugs: Array.isArray(data.artistSlugs) ? data.artistSlugs : [],
  }
}
