import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  clampPricingUnitQuantity,
  parsePricingUnit,
  pricingUnitUsesQuantity,
} from "@/lib/pricing-unit"

export type SalonCart = {
  salonId: string
  serviceIds: string[]
  packageId: string | null
  quantities: Record<string, number>
  priceOptionIds: Record<string, string>
}

type CartContextValue = {
  carts: SalonCart[]
  hydrated: boolean
  totalItems: number
  getCart: (salonId: string) => SalonCart | undefined
  itemCountFor: (salonId: string) => number
  isServiceSelected: (salonId: string, serviceId: string) => boolean
  isPackageSelected: (salonId: string, packageId: string) => boolean
  toggleService: (
    salonId: string,
    serviceId: string,
    meta?: { priceOptionId?: string | null },
  ) => void
  setServiceQuantity: (
    salonId: string,
    serviceId: string,
    quantity: number,
    pricingUnit?: string | null,
  ) => void
  setServicePriceOption: (salonId: string, serviceId: string, optionId: string) => void
  setPackage: (salonId: string, packageId: string | null) => void
  clearSalon: (salonId: string) => void
  clearAll: () => void
}

const CART_KEY = "glammzo_salon_carts"
const CartContext = createContext<CartContextValue | null>(null)

function emptyCart(salonId: string): SalonCart {
  return {
    salonId,
    serviceIds: [],
    packageId: null,
    quantities: {},
    priceOptionIds: {},
  }
}

function cartItemCount(cart: SalonCart) {
  return cart.serviceIds.length + (cart.packageId ? 1 : 0)
}

function isEmptyCart(cart: SalonCart) {
  return cart.serviceIds.length === 0 && !cart.packageId
}

function parseStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const next: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!key || typeof entry !== "string" || !entry.trim()) continue
    next[key] = entry.trim()
  }
  return next
}

function parseQuantityRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const next: Record<string, number> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const parsed =
      typeof entry === "number"
        ? entry
        : typeof entry === "string"
          ? Number(entry)
          : NaN
    if (!key || !Number.isFinite(parsed) || parsed < 1) continue
    next[key] = Math.floor(parsed)
  }
  return next
}

function pruneCartMeta(
  serviceIds: string[],
  quantities: Record<string, number>,
  priceOptionIds: Record<string, string>,
) {
  const nextQuantities: Record<string, number> = {}
  const nextOptions: Record<string, string> = {}
  for (const id of serviceIds) {
    if (quantities[id] != null) nextQuantities[id] = quantities[id]
    if (priceOptionIds[id]) nextOptions[id] = priceOptionIds[id]
  }
  return { quantities: nextQuantities, priceOptionIds: nextOptions }
}

function parseCarts(raw: string | null): SalonCart[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null
        const source = row as SalonCart
        const salonId = String(source.salonId ?? "").trim()
        if (!salonId) return null
        const serviceIds = Array.isArray(source.serviceIds)
          ? source.serviceIds.filter((id): id is string => typeof id === "string")
          : []
        const packageId = typeof source.packageId === "string" ? source.packageId : null
        const cart: SalonCart = {
          salonId,
          serviceIds,
          packageId,
          ...pruneCartMeta(
            serviceIds,
            parseQuantityRecord(source.quantities),
            parseStringRecord(source.priceOptionIds),
          ),
        }
        return isEmptyCart(cart) ? null : cart
      })
      .filter((cart): cart is SalonCart => cart != null)
  } catch {
    return []
  }
}

function replaceCart(prev: SalonCart[], next: SalonCart) {
  const without = prev.filter((cart) => cart.salonId !== next.salonId)
  if (isEmptyCart(next)) return without
  return [...without, next]
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
      toggleService: (salonId, serviceId, meta) => {
        setCarts((prev) => {
          const existing = prev.find((cart) => cart.salonId === salonId) ?? emptyCart(salonId)
          const exists = existing.serviceIds.includes(serviceId)
          const serviceIds = exists
            ? existing.serviceIds.filter((id) => id !== serviceId)
            : [...existing.serviceIds, serviceId]
          const priceOptionIds = { ...existing.priceOptionIds }
          const quantities = { ...existing.quantities }
          if (exists) {
            delete priceOptionIds[serviceId]
            delete quantities[serviceId]
          } else if (meta?.priceOptionId) {
            priceOptionIds[serviceId] = meta.priceOptionId
          }
          return replaceCart(prev, {
            salonId,
            packageId: existing.packageId,
            serviceIds,
            ...pruneCartMeta(serviceIds, quantities, priceOptionIds),
          })
        })
      },
      setServiceQuantity: (salonId, serviceId, quantity, pricingUnit) => {
        setCarts((prev) => {
          const existing = prev.find((cart) => cart.salonId === salonId) ?? emptyCart(salonId)
          const unit = parsePricingUnit(pricingUnit)
          if (quantity < 1) {
            const serviceIds = existing.serviceIds.filter((id) => id !== serviceId)
            return replaceCart(prev, {
              salonId,
              packageId: existing.packageId,
              serviceIds,
              ...pruneCartMeta(serviceIds, existing.quantities, existing.priceOptionIds),
            })
          }
          if (pricingUnit != null && !pricingUnitUsesQuantity(unit)) {
            return prev
          }
          const clamped = clampPricingUnitQuantity(unit, quantity)
          const serviceIds = existing.serviceIds.includes(serviceId)
            ? existing.serviceIds
            : [...existing.serviceIds, serviceId]
          return replaceCart(prev, {
            salonId,
            packageId: existing.packageId,
            serviceIds,
            ...pruneCartMeta(
              serviceIds,
              { ...existing.quantities, [serviceId]: clamped },
              existing.priceOptionIds,
            ),
          })
        })
      },
      setServicePriceOption: (salonId, serviceId, optionId) => {
        const trimmed = optionId.trim()
        if (!trimmed) return
        setCarts((prev) => {
          const existing = prev.find((cart) => cart.salonId === salonId) ?? emptyCart(salonId)
          const serviceIds = existing.serviceIds.includes(serviceId)
            ? existing.serviceIds
            : [...existing.serviceIds, serviceId]
          return replaceCart(prev, {
            salonId,
            packageId: existing.packageId,
            serviceIds,
            ...pruneCartMeta(
              serviceIds,
              existing.quantities,
              { ...existing.priceOptionIds, [serviceId]: trimmed },
            ),
          })
        })
      },
      setPackage: (salonId, packageId) => {
        setCarts((prev) => {
          const existing = prev.find((cart) => cart.salonId === salonId)
          if (!packageId) {
            if (!existing) return prev
            return replaceCart(prev, {
              salonId,
              serviceIds: existing.serviceIds,
              packageId: null,
              quantities: existing.quantities,
              priceOptionIds: existing.priceOptionIds,
            })
          }
          return replaceCart(prev, {
            salonId,
            serviceIds: [],
            packageId,
            quantities: {},
            priceOptionIds: {},
          })
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
