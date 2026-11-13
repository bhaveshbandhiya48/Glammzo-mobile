import { useEffect, useState } from "react"

import {
  fetchArtistCategories,
  fetchArtists,
  type ArtistCardData,
} from "@/lib/artists-api"
import { NEARBY_RADIUS_KM } from "@/lib/explore-location"

const LIMIT = 10

export type TopArtistsState = {
  /** Null while loading or when the artists API is unavailable. */
  artists: ArtistCardData[] | null
  /** Artists with `offersHomeVisits` (who also cover the customer's area when known). */
  homeArtists: ArtistCardData[] | null
  labels: Record<string, string>
}

function byRating(a: ArtistCardData, b: ArtistCardData) {
  const ra = (a.reviewCount ?? 0) > 0 ? a.averageRating ?? 0 : 0
  const rb = (b.reviewCount ?? 0) > 0 ? b.averageRating ?? 0 : 0
  return (
    rb - ra ||
    (b.reviewCount ?? 0) - (a.reviewCount ?? 0) ||
    (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
  )
}

/** Home "Top rated near you" artists: nearby artists from the CRM, best rated first. */
export function useTopArtists(
  latitude: number | undefined,
  longitude: number | undefined,
  refreshKey: number,
): TopArtistsState {
  const [state, setState] = useState<TopArtistsState>({ artists: null, homeArtists: null, labels: {} })

  useEffect(() => {
    const controller = new AbortController()
    const hasPin =
      latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    void (async () => {
      try {
        const [list, categories] = await Promise.all([
          fetchArtists(
            hasPin
              ? { latitude, longitude, radiusKm: NEARBY_RADIUS_KM, sort: "nearest", limit: 50 }
              : { sort: "recommended", limit: 50 },
            controller.signal,
          ),
          fetchArtistCategories(),
        ])
        if (controller.signal.aborted) return
        const labels: Record<string, string> = {}
        for (const category of categories?.categories ?? []) labels[category.id] = category.label
        const sorted = [...(list.artists ?? [])].sort(byRating)
        setState({
          artists: sorted.slice(0, LIMIT),
          homeArtists: sorted
            .filter((artist) => artist.offersHomeVisits && artist.coversYourArea !== false)
            .slice(0, LIMIT),
          labels,
        })
      } catch {
        if (!controller.signal.aborted) setState({ artists: null, homeArtists: null, labels: {} })
      }
    })()
    return () => controller.abort()
  }, [latitude, longitude, refreshKey])

  return state
}
