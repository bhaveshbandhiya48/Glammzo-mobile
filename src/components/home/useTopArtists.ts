import { useEffect, useState, useSyncExternalStore } from "react"

import {
  fetchArtistCategories,
  fetchArtists,
  type ArtistCardData,
} from "@/lib/artists-api"
import { NEARBY_RADIUS_KM } from "@/lib/explore-location"

const LIMIT = 10

export type TopArtistsStatus = "loading" | "ready" | "error"

export type TopArtistsState = {
  status: TopArtistsStatus
  /** Null while loading or when the artists API is unavailable. */
  artists: ArtistCardData[] | null
  /** Artists with `offersHomeVisits` (who also cover the customer's area when known). */
  homeArtists: ArtistCardData[] | null
  labels: Record<string, string>
}

export type NearbyArtistsSnapshot = {
  status: TopArtistsStatus
  /** Every artist from Home's nearby query (10 km, up to 50), in API order. Null unless ready. */
  artists: ArtistCardData[] | null
  labels: Record<string, string>
}

let snapshot: NearbyArtistsSnapshot = { status: "loading", artists: null, labels: {} }
const listeners = new Set<() => void>()

function publish(next: NearbyArtistsSnapshot) {
  snapshot = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => snapshot

/**
 * The full nearby list behind `useTopArtists`, for other Home sections (All near you).
 * Reads what Home already fetched; it never starts a request of its own.
 */
export function useNearbyArtists(): NearbyArtistsSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
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
  const [state, setState] = useState<TopArtistsState>({
    status: "loading",
    artists: null,
    homeArtists: null,
    labels: {},
  })

  useEffect(() => {
    const controller = new AbortController()
    const hasPin =
      latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    // Retrying after a failure: show the loading skeleton again instead of the error card.
    setState((prev) => (prev.status === "error" ? { ...prev, status: "loading" } : prev))
    if (snapshot.status === "error") publish({ ...snapshot, status: "loading" })
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
        const all = list.artists ?? []
        const sorted = [...all].sort(byRating)
        publish({ status: "ready", artists: all, labels })
        setState({
          status: "ready",
          artists: sorted.slice(0, LIMIT),
          homeArtists: sorted
            .filter((artist) => artist.offersHomeVisits && artist.coversYourArea !== false)
            .slice(0, LIMIT),
          labels,
        })
      } catch {
        if (controller.signal.aborted) return
        setState({ status: "error", artists: null, homeArtists: null, labels: {} })
        publish({ status: "error", artists: null, labels: {} })
      }
    })()
    return () => controller.abort()
  }, [latitude, longitude, refreshKey])

  return state
}
