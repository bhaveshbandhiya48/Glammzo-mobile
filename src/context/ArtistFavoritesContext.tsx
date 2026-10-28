import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  fetchFavoriteArtistSlugs,
  toggleFavoriteArtist,
} from "@/lib/artist-favorites-api"
import { getAccessToken } from "@/lib/session"

type ArtistFavoritesContextValue = {
  slugs: string[]
  hydrated: boolean
  isFavorite: (artistSlug: string) => boolean
  /** Returns `auth` when the user must sign in first. */
  toggle: (artistSlug: string) => Promise<"ok" | "auth">
  refresh: () => Promise<void>
}

const FAVORITES_KEY = "glammzo_favorite_artist_slugs"
const ArtistFavoritesContext = createContext<ArtistFavoritesContextValue | null>(
  null,
)

function parseSlugs(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (slug): slug is string => typeof slug === "string" && slug.trim().length > 0,
    )
  } catch {
    return []
  }
}

export function ArtistFavoritesProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  const persist = useCallback(async (next: string[]) => {
    setSlugs(next)
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
  }, [])

  const refresh = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return
    try {
      const remote = await fetchFavoriteArtistSlugs()
      await persist(remote)
    } catch {
      // Keep local cache if sync fails
    }
  }, [persist])

  useEffect(() => {
    let active = true
    ;(async () => {
      const local = parseSlugs(await AsyncStorage.getItem(FAVORITES_KEY))
      if (!active) return
      setSlugs(local)
      setHydrated(true)
      const token = await getAccessToken()
      if (!token || !active) return
      try {
        const remote = await fetchFavoriteArtistSlugs()
        if (!active) return
        await persist(remote)
      } catch {
        // offline / signed-out path keeps local
      }
    })()
    return () => {
      active = false
    }
  }, [persist])

  const toggle = useCallback(
    async (artistSlug: string): Promise<"ok" | "auth"> => {
      const token = await getAccessToken()
      if (!token) return "auth"

      const key = artistSlug.trim().toLowerCase()
      const previous = slugs
      const optimistic = previous.includes(key)
        ? previous.filter((slug) => slug !== key)
        : [...previous, key]
      await persist(optimistic)

      try {
        const result = await toggleFavoriteArtist(key)
        await persist(result.artistSlugs.map((s) => s.trim().toLowerCase()))
        return "ok"
      } catch {
        await persist(previous)
        return "ok"
      }
    },
    [slugs, persist],
  )

  const value = useMemo<ArtistFavoritesContextValue>(
    () => ({
      slugs,
      hydrated,
      isFavorite: (artistSlug) => slugs.includes(artistSlug.trim().toLowerCase()),
      refresh,
      toggle,
    }),
    [slugs, hydrated, refresh, toggle],
  )

  return (
    <ArtistFavoritesContext.Provider value={value}>
      {children}
    </ArtistFavoritesContext.Provider>
  )
}

export function useArtistFavorites() {
  const ctx = useContext(ArtistFavoritesContext)
  if (!ctx) {
    throw new Error("useArtistFavorites must be used within ArtistFavoritesProvider")
  }
  return ctx
}
