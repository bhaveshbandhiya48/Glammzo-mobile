export type ArtistLevelId = "new" | "rising" | "established" | "top_rated"

export const ARTIST_LEVEL_LABEL: Record<ArtistLevelId, string> = {
  new: "Getting started",
  rising: "Rising",
  established: "Established",
  top_rated: "Signature",
}

/** Level medals, same as the Partner app: mint, sky, lavender and gold. */
export const ARTIST_LEVEL_BADGE: Record<
  ArtistLevelId,
  {
    outerTop: string
    outerBottom: string
    stroke: string
    faceTop: string
    faceBottom: string
    emblem: string
    mark: "star" | "crown"
    chevrons: number
  }
> = {
  new: {
    outerTop: "#E3F6EC",
    outerBottom: "#9FD9B9",
    stroke: "#6BBF93",
    faceTop: "#FFFFFF",
    faceBottom: "#E9F8F0",
    emblem: "#1F7A4D",
    mark: "star",
    chevrons: 0,
  },
  rising: {
    outerTop: "#E3EEFE",
    outerBottom: "#A3C1F7",
    stroke: "#6F9BEF",
    faceTop: "#FFFFFF",
    faceBottom: "#EAF2FE",
    emblem: "#1D4ED8",
    mark: "star",
    chevrons: 1,
  },
  established: {
    outerTop: "#EEE8FE",
    outerBottom: "#BBA8F4",
    stroke: "#9478EA",
    faceTop: "#FFFFFF",
    faceBottom: "#F2EEFE",
    emblem: "#5B3CC4",
    mark: "star",
    chevrons: 2,
  },
  top_rated: {
    outerTop: "#FFF4D1",
    outerBottom: "#F0C860",
    stroke: "#D9A93A",
    faceTop: "#FFFDF5",
    faceBottom: "#FFF3CF",
    emblem: "#8A5A00",
    mark: "crown",
    chevrons: 0,
  },
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
