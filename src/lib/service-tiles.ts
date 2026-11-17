/**
 * Home "Book a service" tiles — the one shared list for Home, the all-services
 * sheet and the Service page. Keywords match salon service names / categories
 * as whole words (case-insensitive). `artistCategory` is the CRM artist category.
 */

export type ServiceTileKey =
  | "haircut"
  | "hair-colour"
  | "facial"
  | "makeup"
  | "bridal"
  | "waxing"
  | "threading"
  | "nails"
  | "mehendi"
  | "spa"
  | "beard"
  | "lashes"

export type ArtistCategoryId =
  | "makeup"
  | "hair"
  | "nails"
  | "mehendi"
  | "skin"
  | "lashes"
  | "spa"
  | "waxing"
  | "bridal"
  | "mens"
  | "other"

/** Home Women/Men switch. Matches `SalonService.genderAudience` values. */
export type HomeAudience = "women" | "men"

export type ServiceTile = {
  key: ServiceTileKey
  label: string
  keywords: string[]
  artistCategory: ArtistCategoryId
  /** 150deg two-stop pastel gradient: [from, to]. */
  gradient: [string, string]
  /** Icon stroke colour. */
  ink: string
  /** Icon soft fill colour. */
  fill: string
}

export const SERVICE_TILES: ServiceTile[] = [
  {
    key: "haircut",
    label: "Haircut",
    keywords: ["haircut", "hair cut", "trim", "styling", "blow dry"],
    artistCategory: "hair",
    gradient: ["#fff4ef", "#ffe1d6"],
    ink: "#3b2a24",
    fill: "#ffb59c",
  },
  {
    key: "hair-colour",
    label: "Hair colour",
    keywords: ["colour", "color", "highlights", "balayage", "global colour"],
    artistCategory: "hair",
    gradient: ["#f7f2ff", "#e6dcff"],
    ink: "#2e2440",
    fill: "#cdb8ff",
  },
  {
    key: "facial",
    label: "Facial",
    keywords: ["facial", "clean up", "cleanup", "skin", "peel"],
    artistCategory: "skin",
    gradient: ["#effaf5", "#d3f0e2"],
    ink: "#1f3a2e",
    fill: "#a8e2c6",
  },
  {
    key: "makeup",
    label: "Makeup",
    keywords: ["makeup", "make up", "party makeup"],
    artistCategory: "makeup",
    gradient: ["#fff1f6", "#fbdbe8"],
    ink: "#3d2430",
    fill: "#f59ec0",
  },
  {
    key: "bridal",
    label: "Bridal",
    keywords: ["bridal", "bride", "wedding", "engagement"],
    artistCategory: "bridal",
    gradient: ["#fffaeb", "#fdeec2"],
    ink: "#3a3020",
    fill: "#fbd977",
  },
  {
    key: "waxing",
    label: "Waxing",
    keywords: ["wax", "waxing"],
    artistCategory: "waxing",
    gradient: ["#eefaf9", "#cdeeea"],
    ink: "#183634",
    fill: "#8fd6cc",
  },
  {
    key: "threading",
    label: "Threading",
    keywords: ["threading", "eyebrow", "upper lip"],
    artistCategory: "skin",
    gradient: ["#faf6ef", "#efe4d0"],
    ink: "#382f22",
    fill: "#e2cda2",
  },
  {
    key: "nails",
    label: "Nails",
    keywords: ["nail", "manicure", "pedicure", "gel", "extensions"],
    artistCategory: "nails",
    gradient: ["#fff3f3", "#ffdcdf"],
    ink: "#3d2426",
    fill: "#ffaab4",
  },
  {
    key: "mehendi",
    label: "Mehendi",
    keywords: ["mehendi", "mehndi", "henna"],
    artistCategory: "mehendi",
    gradient: ["#fff5ee", "#fde0cc"],
    ink: "#3d2618",
    fill: "#f2a776",
  },
  {
    key: "spa",
    label: "Spa",
    keywords: ["spa", "massage", "body polish"],
    artistCategory: "spa",
    gradient: ["#f1f8fe", "#d9ebfb"],
    ink: "#1e2e3d",
    fill: "#9fd2f7",
  },
  {
    key: "beard",
    label: "Beard",
    keywords: ["beard", "shave", "grooming"],
    artistCategory: "mens",
    gradient: ["#f2f4f8", "#dde3ee"],
    ink: "#1f2633",
    fill: "#aebbd2",
  },
  {
    key: "lashes",
    label: "Lashes",
    keywords: ["lash", "lashes", "extensions"],
    artistCategory: "lashes",
    gradient: ["#fbf3ff", "#f0dcfa"],
    ink: "#33223d",
    fill: "#dcb0f0",
  },
]

const BY_KEY = new Map(SERVICE_TILES.map((tile) => [tile.key, tile]))

export function getServiceTile(key: string | null | undefined): ServiceTile | undefined {
  if (!key) return undefined
  return BY_KEY.get(key as ServiceTileKey)
}

/** Home grid order (7 tiles, then "All services"). Each list holds only that audience's services. */
export const HOME_TILE_ORDER: Record<HomeAudience, ServiceTileKey[]> = {
  women: ["haircut", "hair-colour", "facial", "makeup", "bridal", "nails", "spa"],
  men: ["haircut", "beard", "hair-colour", "facial", "spa", "waxing", "threading"],
}

/** "All services" sheet per audience, in SERVICE_TILES order. Men never see makeup, bridal, nails, mehendi or lashes; women never see beard. */
export const AUDIENCE_TILE_KEYS: Record<HomeAudience, ServiceTileKey[]> = {
  women: ["haircut", "hair-colour", "facial", "makeup", "bridal", "waxing", "threading", "nails", "mehendi", "spa", "lashes"],
  men: ["haircut", "hair-colour", "facial", "waxing", "threading", "spa", "beard"],
}

export function audienceTiles(audience: HomeAudience): ServiceTile[] {
  return AUDIENCE_TILE_KEYS[audience]
    .map((key) => BY_KEY.get(key))
    .filter((tile): tile is ServiceTile => tile != null)
}

export function homeTiles(audience: HomeAudience): ServiceTile[] {
  return HOME_TILE_ORDER[audience]
    .map((key) => BY_KEY.get(key))
    .filter((tile): tile is ServiceTile => tile != null)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const patternCache = new Map<ServiceTileKey, RegExp>()

function tilePattern(tile: ServiceTile): RegExp {
  const cached = patternCache.get(tile.key)
  if (cached) return cached
  // Whole words (a plain plural counts: "Nails", "Facials"); a space in a keyword
  // also matches "-" or several spaces ("blow-dry").
  const alternatives = tile.keywords
    .map((keyword) =>
      keyword
        .trim()
        .split(/\s+/)
        .map(escapeRegExp)
        .join("[\\s-]+"),
    )
    .join("|")
  const pattern = new RegExp(`(?:^|[^a-z0-9])(?:${alternatives})(?:e?s)?(?=$|[^a-z0-9])`, "i")
  patternCache.set(tile.key, pattern)
  return pattern
}

/** True when `text` (a service name or category) contains one of the tile's keywords as whole words. */
export function matchesTile(text: string | null | undefined, tile: ServiceTile): boolean {
  if (!text) return false
  return tilePattern(tile).test(text)
}

/** Tiles whose keywords appear in any of the texts, in master-list order. */
export function tilesMatching(texts: Array<string | null | undefined>): ServiceTile[] {
  return SERVICE_TILES.filter((tile) => texts.some((text) => matchesTile(text, tile)))
}
