import AsyncStorage from "@react-native-async-storage/async-storage"

import type { Bank, UpiApp } from "@/lib/advance-payment"

/** How the client paid last time, so the next advance is one tap. Saved only after a payment succeeds. */
export type SavedPayMethod =
  | { kind: "upi"; packageName: string; name: string }
  | { kind: "bank"; code: string; name: string }

export type PaySelection =
  | { kind: "upi"; app: UpiApp }
  | { kind: "bank"; bank: Bank }
  /** Cards go through the secure web page. */
  | { kind: "card" }

const KEY = "glammzo.lastPayMethod.v1"

export async function loadSavedPayMethod(): Promise<SavedPayMethod | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as SavedPayMethod
    if (value?.kind === "upi" && typeof value.packageName === "string") return value
    if (value?.kind === "bank" && typeof value.code === "string") return value
    return null
  } catch {
    return null
  }
}

export async function savePayMethod(selection: PaySelection) {
  const value: SavedPayMethod | null =
    selection.kind === "upi"
      ? { kind: "upi", packageName: selection.app.packageName, name: selection.app.name }
      : selection.kind === "bank"
        ? { kind: "bank", code: selection.bank.code, name: selection.bank.name }
        : null
  if (!value) return
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // Remembering is a convenience; the payment already went through.
  }
}

/** The saved method, if this phone still offers it (the UPI app may have been uninstalled). */
export function resolveSavedPayMethod(
  saved: SavedPayMethod | null,
  options: { upiApps: UpiApp[]; banks: Bank[] },
): PaySelection | null {
  if (!saved) return null
  if (saved.kind === "upi") {
    const app = options.upiApps.find((a) => a.packageName === saved.packageName)
    return app ? { kind: "upi", app } : null
  }
  const bank = options.banks.find((b) => b.code === saved.code)
  return bank ? { kind: "bank", bank } : null
}

export function paySelectionLabel(selection: PaySelection) {
  if (selection.kind === "upi") return selection.app.name
  if (selection.kind === "bank") return selection.bank.name
  return "Card"
}
