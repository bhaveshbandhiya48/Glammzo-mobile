export type ArtistLevelId = "new" | "rising" | "established" | "top_rated"

export const ARTIST_LEVEL_LABEL: Record<ArtistLevelId, string> = {
  new: "Getting started",
  rising: "Rising",
  established: "Established",
  top_rated: "Top rated",
}

/** Soft medal fills — same shape as CRM artist app. */
export const ARTIST_LEVEL_BADGE: Record<
  ArtistLevelId,
  { fill: string; ink: string; dots: number }
> = {
  new: { fill: "#B7A99A", ink: "#FFFFFF", dots: 0 },
  rising: { fill: "#111111", ink: "#FFFFFF", dots: 1 },
  established: { fill: "#5C7C6A", ink: "#FFFFFF", dots: 2 },
  top_rated: { fill: "#C9893A", ink: "#FFFFFF", dots: 3 },
}

export function parseArtistLevel(value: unknown): ArtistLevelId {
  if (value === "rising" || value === "established" || value === "top_rated") {
    return value
  }
  return "new"
}

/** The starting level is internal; customers only see earned levels. */
export function showArtistLevelToCustomers(level: ArtistLevelId) {
  return level !== "new"
}

export function artistLevelLabel(level: ArtistLevelId, fallback?: string | null) {
  return fallback?.trim() || ARTIST_LEVEL_LABEL[level]
}
