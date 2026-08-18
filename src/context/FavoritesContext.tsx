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

import { fetchFavoriteSalonIds, toggleFavoriteSalon } from "@/lib/favorites-api"
import { getAccessToken } from "@/lib/session"

type FavoritesContextValue = {
  ids: string[]
  hydrated: boolean
  isFavorite: (salonId: string) => boolean
  /** Returns `auth` when the user must sign in first. */
  toggle: (salonId: string) => Promise<"ok" | "auth">
  refresh: () => Promise<void>
}

const FAVORITES_KEY = "glammzo_favorite_salon_ids"
const FavoritesContext = createContext<FavoritesContextValue | null>(null)

function parseIds(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0,
    )
  } catch {
    return []
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  const persist = useCallback(async (next: string[]) => {
    setIds(next)
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
  }, [])

  const refresh = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return
    try {
      const remote = await fetchFavoriteSalonIds()
      await persist(remote)
    } catch {
      // Keep local cache if sync fails
    }
  }, [persist])

  useEffect(() => {
    let active = true
    ;(async () => {
      const local = parseIds(await AsyncStorage.getItem(FAVORITES_KEY))
      if (!active) return
      setIds(local)
      setHydrated(true)
      const token = await getAccessToken()
      if (!token || !active) return
      try {
        const remote = await fetchFavoriteSalonIds()
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
    async (salonId: string): Promise<"ok" | "auth"> => {
      const token = await getAccessToken()
      if (!token) return "auth"

      const previous = ids
      const optimistic = previous.includes(salonId)
        ? previous.filter((id) => id !== salonId)
        : [...previous, salonId]
      await persist(optimistic)

      try {
        const result = await toggleFavoriteSalon(salonId)
        await persist(result.salonIds)
        return "ok"
      } catch {
        await persist(previous)
        return "ok"
      }
    },
    [ids, persist],
  )

  const value = useMemo<FavoritesContextValue>(
    () => ({
      ids,
      hydrated,
      isFavorite: (salonId) => ids.includes(salonId),
      refresh,
      toggle,
    }),
    [ids, hydrated, refresh, toggle],
  )

  return (
    <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider")
  return ctx
}
