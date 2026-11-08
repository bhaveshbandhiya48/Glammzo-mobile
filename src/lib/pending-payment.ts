import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * The advance payment the client last started. Saved before the UPI app or bank page opens, so
 * the app can still find out what happened if Android closes it while the client is paying.
 */
export type PendingPayment = {
  token: string
  orderId: string
  amountPaise: number
  startedAt: number
}

const KEY = "glammzo.pendingAdvancePayment"
/** Holds last a few minutes; after this long the server has settled the payment either way. */
const MAX_AGE_MS = 60 * 60 * 1000

export async function savePendingPayment(payment: Omit<PendingPayment, "startedAt">) {
  const value: PendingPayment = { ...payment, startedAt: Date.now() }
  await AsyncStorage.setItem(KEY, JSON.stringify(value)).catch(() => undefined)
}

export async function readPendingPayment(): Promise<PendingPayment | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<PendingPayment>
    if (!value.token || !value.orderId || typeof value.startedAt !== "number") return null
    if (Date.now() - value.startedAt > MAX_AGE_MS) {
      await clearPendingPayment()
      return null
    }
    return value as PendingPayment
  } catch {
    return null
  }
}

/** Only clears the record for this booking, so an older check can't wipe a newer payment. */
export async function clearPendingPayment(token?: string) {
  try {
    if (token) {
      const current = await AsyncStorage.getItem(KEY)
      if (current && (JSON.parse(current) as Partial<PendingPayment>).token !== token) return
    }
    await AsyncStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
