import { apiFetch } from "@/lib/api"

export type PlacePrediction = {
  placeId: string
  primaryText: string
  secondaryText: string
  description: string
}

export type ResolvedPlace = {
  placeId: string
  label: string
  formattedAddress: string
  latitude: number
  longitude: number
  city?: string
  area?: string
  state?: string
}

export async function fetchPlaceAutocomplete(input: {
  query: string
  sessionToken?: string
  latitude?: number
  longitude?: number
}): Promise<PlacePrediction[]> {
  const params = new URLSearchParams({ q: input.query.trim() })
  if (input.sessionToken) params.set("sessionToken", input.sessionToken)
  if (
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude) &&
    input.latitude != null &&
    input.longitude != null
  ) {
    params.set("lat", String(input.latitude))
    params.set("lng", String(input.longitude))
  }

  const data = await apiFetch<{ ok: boolean; predictions: PlacePrediction[] }>(
    `/api/mobile/location/autocomplete?${params.toString()}`,
    { auth: false },
  )
  return data.predictions ?? []
}

export async function fetchPlaceDetails(input: {
  placeId: string
  sessionToken?: string
}): Promise<ResolvedPlace> {
  const params = new URLSearchParams({ placeId: input.placeId })
  if (input.sessionToken) params.set("sessionToken", input.sessionToken)

  const data = await apiFetch<{ ok: boolean; place: ResolvedPlace }>(
    `/api/mobile/location/details?${params.toString()}`,
    { auth: false },
  )
  return data.place
}

export async function reverseGeocode(input: {
  latitude: number
  longitude: number
}): Promise<ResolvedPlace> {
  const params = new URLSearchParams({
    lat: String(input.latitude),
    lng: String(input.longitude),
  })
  const data = await apiFetch<{ ok: boolean; place: ResolvedPlace }>(
    `/api/mobile/location/reverse?${params.toString()}`,
    { auth: false },
  )
  return data.place
}

export async function fetchNearbyAreas(input: {
  latitude: number
  longitude: number
}): Promise<PlacePrediction[]> {
  const params = new URLSearchParams({
    lat: String(input.latitude),
    lng: String(input.longitude),
  })
  const data = await apiFetch<{ ok: boolean; areas: PlacePrediction[] }>(
    `/api/mobile/location/nearby?${params.toString()}`,
    { auth: false },
  )
  return (data.areas ?? []).slice(0, 3)
}

export function createPlacesSessionToken() {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
