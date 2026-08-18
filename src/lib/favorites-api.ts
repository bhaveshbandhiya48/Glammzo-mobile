import { apiFetch } from "@/lib/api"

export async function fetchFavoriteSalonIds(): Promise<string[]> {
  const data = await apiFetch<{ ok: boolean; salonIds: string[] }>(
    "/api/mobile/favorites",
  )
  return Array.isArray(data.salonIds) ? data.salonIds : []
}

export async function toggleFavoriteSalon(
  salonId: string,
): Promise<{ favorited: boolean; salonIds: string[] }> {
  const data = await apiFetch<{
    ok: boolean
    favorited: boolean
    salonIds: string[]
  }>("/api/mobile/favorites", {
    method: "POST",
    body: { salonId },
  })
  return {
    favorited: Boolean(data.favorited),
    salonIds: Array.isArray(data.salonIds) ? data.salonIds : [],
  }
}
