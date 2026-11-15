import { AppState, Linking, NativeModules, Platform } from "react-native"

import { CRM_URL } from "@/lib/config"
import { clearPendingPayment, savePendingPayment } from "@/lib/pending-payment"

/** One Razorpay order for a held booking; retries on the pay screen reuse it. */
export type AdvanceOrder = {
  keyId: string
  orderId: string
  amountPaise: number
  artistName: string
  serviceName: string
  customerName: string
  customerPhone: string
  holdExpiresAt: string | null
}

export type UpiApp = { name: string; packageName: string; iconBase64?: string; logoUrl?: string }
export type Bank = { code: string; name: string }

export type PayMethod =
  | { method: "upi"; packageName: string }
  | { method: "netbanking"; bank: string }

export type PayOutcome =
  /** Booking confirmed. */
  | { kind: "paid" }
  /** Money came in after the hold ended; the server refunds it. */
  | { kind: "refunding" }
  /** Client closed the payment or it failed: they can try again. */
  | { kind: "not_paid"; message: string | null }
  /** We can't tell yet: the webhook will settle it. */
  | { kind: "checking" }

type NativeRazorpay = {
  initRazorpay: (key: string) => void
  getAppsWhichSupportUPI: () => Promise<{ data?: unknown }>
  getPaymentMethods: () => Promise<{ netbanking?: unknown }>
  open: (options: Record<string, unknown>) => Promise<{
    razorpay_payment_id?: string
    razorpay_order_id?: string
    razorpay_signature?: string
  }>
}

/** Null where the native module isn't in the build (Expo Go, web): the screen uses the web page instead. */
function razorpay(): NativeRazorpay | null {
  if (!NativeModules.RazorpayCustomui) return null
  // iOS sends results through a second native module; Android uses the standard event channel.
  if (Platform.OS === "ios" && !NativeModules.RazorpayEventEmitterCustom) return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("react-native-customui") as { default: NativeRazorpay }).default
}

export function isInAppPaymentAvailable() {
  return razorpay() != null
}

/**
 * Salon advance tokens are "<appointment id>.<signature>"; artist bookings use their plain public
 * token. The same pay screen handles both and only the CRM endpoints differ.
 */
export function isSalonAdvanceToken(token: string) {
  return token.includes(".")
}

export function advanceWebPageUrl(token: string) {
  return isSalonAdvanceToken(token)
    ? `${CRM_URL}/pay/salon/${encodeURIComponent(token)}`
    : `${CRM_URL}/pay/booking/${encodeURIComponent(token)}`
}

function advanceEndpoint(token: string) {
  return isSalonAdvanceToken(token)
    ? `${CRM_URL}/api/public/salon-advance/${encodeURIComponent(token)}`
    : `${CRM_URL}/api/public/bookings/${encodeURIComponent(token)}/advance`
}

async function post<T>(token: string, body: unknown): Promise<T> {
  const response = await fetch(advanceEndpoint(token), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || "Could not start the payment.")
  return data
}

export function createAdvanceOrder(token: string) {
  return post<AdvanceOrder>(token, {})
}

/** The publishable key, to list payment options before a booking exists. */
export async function fetchPaymentKeyId(): Promise<string> {
  const response = await fetch(`${CRM_URL}/api/public/payments/key`, { headers: { Accept: "application/json" } })
  const data = (await response.json().catch(() => ({}))) as { keyId?: string }
  if (!response.ok || !data.keyId) throw new Error("Could not load payment options.")
  return data.keyId
}

/** The native SDK can stay silent, so nothing here may wait forever. */
function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 5000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

const RECORD = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {})

/** The UPI apps Razorpay's iOS SDK knows, by the code it expects. Schemes are listed in app.config.js. */
const KNOWN_UPI_APPS = [
  { name: "Google Pay", packageName: "google_pay", scheme: "tez://upi/pay" },
  { name: "PhonePe", packageName: "phonepe", scheme: "phonepe://pay" },
  { name: "Paytm", packageName: "paytm", scheme: "paytmmp://upi/pay" },
  { name: "BHIM", packageName: "bhim", scheme: "bhim://upi/pay" },
  { name: "CRED", packageName: "cred", scheme: "credpay://upi/pay" },
]

/** Razorpay's own logo for the apps it knows; its iOS list comes without icons. */
function knownLogo(code: string) {
  return KNOWN_UPI_APPS.some((a) => a.packageName === code) ? `https://cdn.razorpay.com/app/${code}.png` : undefined
}

function friendlyAppName(code: string) {
  return KNOWN_UPI_APPS.find((a) => a.packageName === code)?.name ?? code
}

/**
 * Android sends { appName, packageName, iconBase64 }. On iOS the library wraps each SDK entry
 * as { appName: <the entry> }, and the entry holds the app's name and short code.
 */
export function toUpiApp(raw: unknown): UpiApp | null {
  const outer = RECORD(raw)
  const nested = outer.appName && typeof outer.appName === "object" ? RECORD(outer.appName) : null
  const r = nested ?? outer
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const plainName = text(r.appName) || text(r.app_name) || text(r.name)
  const packageName =
    text(r.packageName) ||
    text(r.package_name) ||
    text(r.appPackageName) ||
    text(r.shortcode) ||
    text(r.shortCode) ||
    text(r.upiShortCode) ||
    plainName
  if (!packageName) return null
  const iconBase64 = text(r.iconBase64) || undefined
  const logoUrl = text(r.appLogo) || knownLogo(packageName)
  return { name: plainName && plainName !== packageName ? plainName : friendlyAppName(packageName), packageName, iconBase64, logoUrl }
}

/** Razorpay usually sends { HDFC: "HDFC Bank" }; lists and nested objects are read too. */
export function toBanks(raw: unknown): Bank[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        const r = RECORD(item)
        const code = String(r.code ?? r.bank_code ?? r.id ?? "").trim()
        const name = String(r.name ?? r.bank_name ?? r.display_name ?? code).trim()
        return code ? { code, name } : null
      })
      .filter((b): b is Bank => b != null)
  }
  const record = RECORD(raw)
  if (Array.isArray(record.banks) || (record.banks && typeof record.banks === "object")) return toBanks(record.banks)
  return Object.entries(record)
    .map(([code, value]) => {
      const name = typeof value === "string" ? value : String(RECORD(value).name ?? code)
      return { code, name: name.trim() || code }
    })
}

/** Kept for the session so a second payment opens with its options already there. */
let cachedOptions: { keyId: string; upiApps: UpiApp[]; banks: Bank[] } | null = null
let loadingOptions: { keyId: string; promise: Promise<{ upiApps: UpiApp[]; banks: Bank[] }> } | null = null
/** True while Razorpay's payment screen is open. Re-initialising the SDK then breaks the payment on iOS. */
let paymentInFlight = false

/**
 * The SDK's helper clears every listener when any call answers, so the two lookups run one after
 * the other, and two loads never run at once.
 */
export function loadPaymentOptions(keyId: string): Promise<{ upiApps: UpiApp[]; banks: Bank[] }> {
  if (cachedOptions?.keyId === keyId) return Promise.resolve(cachedOptions)
  if (loadingOptions?.keyId === keyId) return loadingOptions.promise
  const promise = fetchPaymentOptions(keyId).finally(() => {
    if (loadingOptions?.promise === promise) loadingOptions = null
  })
  loadingOptions = { keyId, promise }
  return promise
}

async function fetchPaymentOptions(keyId: string): Promise<{ upiApps: UpiApp[]; banks: Bank[] }> {
  const sdk = razorpay()
  if (!sdk || paymentInFlight) return { upiApps: [], banks: [] }
  sdk.initRazorpay(keyId)
  // Android finishes setting up on its UI thread, and asking for payment methods before that crashes.
  await new Promise((resolve) => setTimeout(resolve, 300))
  const apps = await withTimeout(sdk.getAppsWhichSupportUPI(), { data: [] })
  const list = Array.isArray(apps?.data) ? apps.data : Array.isArray(apps) ? (apps as unknown[]) : []
  const methods = await withTimeout(sdk.getPaymentMethods(), { netbanking: {} })
  if (__DEV__) console.log("[advance-payment] SDK options", JSON.stringify({ apps, netbanking: methods?.netbanking }).slice(0, 1500))

  let upiApps = list.map(toUpiApp).filter((a): a is UpiApp => a != null)
  if (upiApps.length === 0 && Platform.OS === "ios") {
    // Razorpay's list can come back empty: ask iOS directly which of the apps it knows are installed.
    const found = await Promise.all(
      KNOWN_UPI_APPS.map(async (app) => ((await Linking.canOpenURL(app.scheme).catch(() => false)) ? app : null)),
    )
    upiApps = found
      .filter((a): a is (typeof KNOWN_UPI_APPS)[number] => a != null)
      .map(({ name, packageName }) => ({ name, packageName, logoUrl: knownLogo(packageName) }))
  }
  const banks = toBanks(methods?.netbanking)
  if (upiApps.length > 0 || banks.length > 0) cachedOptions = { keyId, upiApps, banks }
  return { upiApps, banks }
}

/**
 * Looks up the UPI apps and banks once the app has started, so the payment sheet opens with them
 * already listed instead of waiting on Razorpay.
 */
export async function prefetchPaymentOptions() {
  if (!razorpay() || paymentInFlight) return
  try {
    await loadPaymentOptions(await fetchPaymentKeyId())
  } catch {
    // The sheet loads them itself.
  }
}

async function advancePaid(token: string): Promise<boolean> {
  try {
    if (isSalonAdvanceToken(token)) {
      const response = await fetch(advanceEndpoint(token), { headers: { Accept: "application/json" } })
      if (!response.ok) return false
      return Boolean(((await response.json()) as { paid?: boolean }).paid)
    }
    const response = await fetch(`${CRM_URL}/api/public/bookings/${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json" },
    })
    if (!response.ok) return false
    const data = (await response.json()) as { booking?: { status?: string; advancePaid?: boolean } }
    return data.booking?.status === "confirmed" || data.booking?.advancePaid === true
  } catch {
    return false
  }
}

/** True once the booking is confirmed: used when the app can't be sure a payment went through. */
export async function isAdvanceConfirmed(token: string, attempts = 1) {
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 2000))
    if (await advancePaid(token)) return true
  }
  return false
}

export type AdvanceStatus = "paid" | "refunding" | "failed" | "pending"

/**
 * Asks the server where the payment stands. The server checks with Razorpay itself, so this works
 * even when the app never heard back from the payment screen. Servers without the status endpoint
 * yet answer from the booking alone.
 */
export async function checkAdvanceStatus(token: string): Promise<AdvanceStatus> {
  try {
    const response = await fetch(`${advanceEndpoint(token)}/status`, { headers: { Accept: "application/json" } })
    if (response.ok) {
      const data = (await response.json()) as { status?: string }
      if (data.status === "paid" || data.status === "refunding" || data.status === "failed" || data.status === "pending") {
        return data.status
      }
    }
  } catch {
    // Fall back to the booking below.
  }
  return (await advancePaid(token)) ? "paid" : "pending"
}

/** Checks every 2 seconds until the payment settles or the attempts run out. */
export async function waitForAdvanceStatus(token: string, attempts: number): Promise<AdvanceStatus> {
  let status: AdvanceStatus = "pending"
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 2000))
    status = await checkAdvanceStatus(token)
    if (status !== "pending") break
  }
  return status
}

type OpenResult = Awaited<ReturnType<NativeRazorpay["open"]>>
type Opened = { kind: "result"; result: OpenResult } | { kind: "error"; error: unknown } | { kind: "vanished" }

/** How long the payment screen gets to report back once our screen is in front again. */
const VANISH_GRACE_MS = 4000

/**
 * Opens Razorpay's payment screen and waits for its answer. On Android our screen only comes back
 * to the front once that screen has closed, and it normally reports first. If it closed without
 * reporting (the client came back through the app icon or Recents, or Android restarted it), we
 * stop waiting instead of leaving the client stuck.
 */
function openPaymentScreen(sdk: NativeRazorpay, options: Record<string, unknown>): Promise<Opened> {
  return new Promise((resolve) => {
    let settled = false
    let graceTimer: ReturnType<typeof setTimeout> | null = null
    let sawBackground = false
    const finish = (value: Opened) => {
      if (settled) return
      settled = true
      if (graceTimer) clearTimeout(graceTimer)
      subscription?.remove()
      resolve(value)
    }
    const subscription =
      Platform.OS === "android"
        ? AppState.addEventListener("change", (state) => {
            if (state !== "active") {
              sawBackground = true
              if (graceTimer) clearTimeout(graceTimer)
              graceTimer = null
              return
            }
            if (!sawBackground || graceTimer) return
            graceTimer = setTimeout(() => finish({ kind: "vanished" }), VANISH_GRACE_MS)
          })
        : null
    sdk.open(options).then(
      (result) => finish({ kind: "result", result }),
      (error: unknown) => finish({ kind: "error", error }),
    )
  })
}

export async function payAdvance(input: {
  token: string
  order: AdvanceOrder
  method: PayMethod
  email: string
  /** Called once the payment screen has closed and we are confirming with the server. */
  onConfirming?: () => void
}): Promise<PayOutcome> {
  const sdk = razorpay()
  if (!sdk) return { kind: "not_paid", message: null }
  const { order, method } = input

  await savePendingPayment({ token: input.token, orderId: order.orderId, amountPaise: order.amountPaise })
  paymentInFlight = true
  try {
    const opened = await openPaymentScreen(sdk, {
      key_id: order.keyId,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: "INR",
      description: `Advance · ${order.serviceName}`,
      contact: order.customerPhone,
      email: input.email,
      ...(method.method === "upi"
        ? { method: "upi", upi_app_package_name: method.packageName, "_[flow]": "intent" }
        : { method: "netbanking", bank: method.bank }),
    })
    input.onConfirming?.()

    const outcome = await settle(input.token, order, opened)
    // Keep the record while we still don't know, so the next app start checks it again.
    if (outcome.kind === "paid" || outcome.kind === "refunding") await clearPendingPayment(input.token)
    return outcome
  } finally {
    paymentInFlight = false
  }
}

/** True from opening the payment screen until its result is settled. */
export function isPaymentInFlight() {
  return paymentInFlight
}

function fromStatus(status: AdvanceStatus): PayOutcome | null {
  if (status === "paid") return { kind: "paid" }
  if (status === "refunding") return { kind: "refunding" }
  return null
}

/** Our Android patch's code for "the payment screen lost its payment", not a real failure. */
const SCREEN_LOST_CODE = 1001

async function settle(token: string, order: AdvanceOrder, opened: Opened): Promise<PayOutcome> {
  if (opened.kind === "vanished" || (opened.kind === "error" && RECORD(opened.error).code === SCREEN_LOST_CODE)) {
    return fromStatus(await waitForAdvanceStatus(token, 5)) ?? { kind: "checking" }
  }

  if (opened.kind === "error") {
    // A UPI app can report a failure after the money has moved, so check before saying so.
    const status = await waitForAdvanceStatus(token, 2)
    const known = fromStatus(status)
    if (known) return known
    const description = RECORD(opened.error).description
    return { kind: "not_paid", message: typeof description === "string" ? description : null }
  }

  const { razorpay_payment_id: paymentId, razorpay_signature: signature } = opened.result
  if (!paymentId || !signature) {
    return fromStatus(await waitForAdvanceStatus(token, 5)) ?? { kind: "checking" }
  }
  try {
    const done = await post<{ needsRefund?: boolean }>(token, { orderId: order.orderId, paymentId, signature })
    return done.needsRefund ? { kind: "refunding" } : { kind: "paid" }
  } catch {
    // The money is in; the server confirms the booking if this call failed.
    return fromStatus(await waitForAdvanceStatus(token, 5)) ?? { kind: "checking" }
  }
}
