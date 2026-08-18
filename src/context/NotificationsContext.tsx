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
import { AppState } from "react-native"

import { fetchBookings } from "@/lib/bookings-api"
import {
  buildNotifications,
  type AppNotification,
  type AppNotificationType,
} from "@/lib/notifications-build"
import { syncLocalBookingReminders } from "@/lib/push"
import { fetchLoyalty, fetchWallet } from "@/lib/wallet-api"
import { getAccessToken } from "@/lib/session"

export type { AppNotification, AppNotificationType }

type NotificationsContextValue = {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  signedIn: boolean
  refresh: () => Promise<void>
  markRead: (id: string) => void
  markAllRead: () => void
  clearAll: () => void
}

const READ_KEY = "glammzo_notification_read_ids"
const CLEARED_KEY = "glammzo_notification_cleared_ids"

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

async function loadIdSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === "string"))
  } catch {
    return new Set()
  }
}

async function saveIdSet(key: string, ids: Set<string>) {
  await AsyncStorage.setItem(key, JSON.stringify([...ids]))
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(false)

  const refresh = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) {
      setSignedIn(false)
      setNotifications([])
      setLoading(false)
      return
    }

    setSignedIn(true)
    setLoading(true)
    try {
      const [storedRead, storedCleared] = await Promise.all([
        loadIdSet(READ_KEY),
        loadIdSet(CLEARED_KEY),
      ])
      setReadIds(storedRead)
      setClearedIds(storedCleared)

      const [bookings, wallet, loyalty] = await Promise.all([
        fetchBookings().catch(() => []),
        fetchWallet().catch(() => null),
        fetchLoyalty().catch(() => ({
          completedVisits: 0,
          freeServiceCredits: 0,
          stampsTowardNextFree: 0,
          visitsLeft: 10,
        })),
      ])

      const built = buildNotifications({
        bookings,
        ledger: wallet?.ledger ?? [],
        loyalty,
        readIds: storedRead,
      })

      setNotifications(built.filter((item) => !storedCleared.has(item.id)))

      void syncLocalBookingReminders(bookings).catch(() => undefined)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh()
    })
    return () => sub.remove()
  }, [refresh])

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      void saveIdSet(READ_KEY, next)
      return next
    })
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    )
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = new Set(readIds)
      for (const item of prev) next.add(item.id)
      void saveIdSet(READ_KEY, next)
      setReadIds(next)
      return prev.map((item) => ({ ...item, read: true }))
    })
  }, [readIds])

  const clearAll = useCallback(() => {
    setNotifications((prev) => {
      if (prev.length === 0) return prev
      const nextCleared = new Set(clearedIds)
      const nextRead = new Set(readIds)
      for (const item of prev) {
        nextCleared.add(item.id)
        nextRead.add(item.id)
      }
      void saveIdSet(CLEARED_KEY, nextCleared)
      void saveIdSet(READ_KEY, nextRead)
      setClearedIds(nextCleared)
      setReadIds(nextRead)
      return []
    })
  }, [clearedIds, readIds])

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((item) => !item.read).length,
      loading,
      signedIn,
      refresh,
      markRead,
      markAllRead,
      clearAll,
    }),
    [
      notifications,
      loading,
      signedIn,
      refresh,
      markRead,
      markAllRead,
      clearAll,
    ],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider")
  }
  return ctx
}
