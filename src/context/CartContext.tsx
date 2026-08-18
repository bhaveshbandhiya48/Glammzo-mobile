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

export type SalonCart = {
  salonId: string
  serviceIds: string[]
  packageId: string | null
}

type CartContextValue = {
  carts: SalonCart[]
  hydrated: boolean
  totalItems: number
  getCart: (salonId: string) => SalonCart | undefined
  itemCountFor: (salonId: string) => number
  isServiceSelected: (salonId: string, serviceId: string) => boolean
  isPackageSelected: (salonId: string, packageId: string) => boolean
  toggleService: (salonId: string, serviceId: string) => void
  setPackage: (salonId: string, packageId: string | null) => void
  clearSalon: (salonId: string) => void
  clearAll: () => void
}

const CART_KEY = "glammzo_salon_carts"
const CartContext = createContext<CartContextValue | null>(null)

function cartItemCount(cart: SalonCart) {
  return cart.serviceIds.length + (cart.packageId ? 1 : 0)
}

function isEmptyCart(cart: SalonCart) {
  return cart.serviceIds.length === 0 && !cart.packageId
}

function parseCarts(raw: string | null): SalonCart[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null
        const salonId = String((row as SalonCart).salonId ?? "").trim()
        if (!salonId) return null
        const serviceIds = Array.isArray((row as SalonCart).serviceIds)
          ? (row as SalonCart).serviceIds.filter((id): id is string => typeof id === "string")
          : []
        const packageId =
          typeof (row as SalonCart).packageId === "string"
            ? (row as SalonCart).packageId
            : null
        const cart: SalonCart = { salonId, serviceIds, packageId }
        return isEmptyCart(cart) ? null : cart
      })
      .filter((cart): cart is SalonCart => cart != null)
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [carts, setCarts] = useState<SalonCart[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let active = true
    AsyncStorage.getItem(CART_KEY)
      .then((raw) => {
        if (!active) return
        setCarts(parseCarts(raw))
      })
      .finally(() => {
        if (active) setHydrated(true)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    void AsyncStorage.setItem(CART_KEY, JSON.stringify(carts))
  }, [carts, hydrated])

  const value = useMemo<CartContextValue>(
    () => ({
      carts,
      hydrated,
      totalItems: carts.reduce((sum, cart) => sum + cartItemCount(cart), 0),
      getCart: (salonId) => carts.find((cart) => cart.salonId === salonId),
      itemCountFor: (salonId) => {
        const cart = carts.find((entry) => entry.salonId === salonId)
        return cart ? cartItemCount(cart) : 0
      },
      isServiceSelected: (salonId, serviceId) => {
        const cart = carts.find((entry) => entry.salonId === salonId)
        return Boolean(cart?.serviceIds.includes(serviceId))
      },
      isPackageSelected: (salonId, packageId) => {
        const cart = carts.find((entry) => entry.salonId === salonId)
        return cart?.packageId === packageId
      },
      toggleService: (salonId, serviceId) => {
        setCarts((prev) => {
          const existing = prev.find((cart) => cart.salonId === salonId)
          const base: SalonCart = existing ?? {
            salonId,
            serviceIds: [],
            packageId: null,
          }
          const exists = base.serviceIds.includes(serviceId)
          const serviceIds = exists
            ? base.serviceIds.filter((id) => id !== serviceId)
            : [...base.serviceIds, serviceId]
          const next: SalonCart = {
            salonId,
            packageId: base.packageId,
            serviceIds,
          }
          const without = prev.filter((cart) => cart.salonId !== salonId)
          if (isEmptyCart(next)) return without
          return [...without, next]
        })
      },
      setPackage: (salonId, packageId) => {
        setCarts((prev) => {
          const existing = prev.find((cart) => cart.salonId === salonId)
          const without = prev.filter((cart) => cart.salonId !== salonId)
          if (!packageId) {
            if (!existing) return prev
            const next: SalonCart = {
              salonId,
              serviceIds: existing.serviceIds,
              packageId: null,
            }
            if (isEmptyCart(next)) return without
            return [...without, next]
          }
          return [...without, { salonId, serviceIds: [], packageId }]
        })
      },
      clearSalon: (salonId) => {
        setCarts((prev) => prev.filter((cart) => cart.salonId !== salonId))
      },
      clearAll: () => setCarts([]),
    }),
    [carts, hydrated],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}
