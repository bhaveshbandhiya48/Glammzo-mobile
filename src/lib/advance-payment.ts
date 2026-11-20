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
  if (!razorpay()) return { kind: "not_paid", message: null }
  const { token, order } = input

  await savePendingPayment({ token, orderId: order.orderId, amountPaise: order.amountPaise })
  const outcome = await payRazorpayOrder({
    order: {
      keyId: order.keyId,
      orderId: order.orderId,
      amountPaise: order.amountPaise,
      description: `Advance · ${order.serviceName}`,
      contact: order.customerPhone,
    },
    method: input.method,
    email: input.email,
    upiUrl: `${advanceEndpoint(token)}/upi`,
    waitForStatus: (attempts) => waitForAdvanceStatus(token, attempts),
    confirm: async (proof) => {
      const done = await post<{ needsRefund?: boolean }>(token, proof)
      return done.needsRefund ? { kind: "refunding" } : { kind: "paid" }
    },
    onConfirming: input.onConfirming,
  })
  // Keep the record while we still don't know, so the next app start checks it again.
  if (outcome.kind === "paid" || outcome.kind === "refunding") await clearPendingPayment(token)
  return outcome
}

/** What Razorpay's payment screen needs for one order. */
export type CheckoutOrder = {
  keyId: string
  orderId: string
  amountPaise: number
  description: string
  contact: string
}

/**
 * Pays one Razorpay order inside the app: UPI opens the chosen UPI app straight on its PIN screen
 * when it can, otherwise Razorpay's own payment screen (UPI or net banking). Shared by booking
 * advances and gift cards; only the server endpoints differ.
 */
export async function payRazorpayOrder(input: {
  order: CheckoutOrder
  method: PayMethod
  email: string
  /** The server's POST endpoint that turns { orderId } into a `upi://pay` link. */
  upiUrl: string
  /** Polls the server (which asks Razorpay) every 2 seconds, up to `attempts` times. */
  waitForStatus: (attempts: number) => Promise<AdvanceStatus>
  /** Sends Razorpay's success proof to the server. Throwing means "ask the server again later". */
  confirm: (proof: { orderId: string; paymentId: string; signature: string }) => Promise<PayOutcome>
  onConfirming?: () => void
}): Promise<PayOutcome> {
  const sdk = razorpay()
  if (!sdk) return { kind: "not_paid", message: null }
  const { order, method } = input

  paymentInFlight = true
  try {
    if (method.method === "upi") {
      const direct = await payWithUpiIntent({
        upiUrl: input.upiUrl,
        orderId: order.orderId,
        appCode: method.packageName,
        waitForStatus: input.waitForStatus,
        onConfirming: input.onConfirming,
      })
      if (direct) return direct
      // The server or this phone can't do UPI intent: use Razorpay's payment screen instead.
    }

    const opened = await openPaymentScreen(sdk, {
      key_id: order.keyId,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: "INR",
      description: order.description,
      contact: order.contact,
      email: input.email,
      ...(method.method === "upi"
        ? { method: "upi", upi_app_package_name: method.packageName, "_[flow]": "intent" }
        : { method: "netbanking", bank: method.bank }),
    })
    input.onConfirming?.()
    return await settle(order.orderId, opened, input.waitForStatus, input.confirm)
  } finally {
    paymentInFlight = false
  }
}

type UpiLauncher = {
  openUpiApp: (url: string, packageName: string) => Promise<{ resultCode?: number; response?: string } | null>
}

/** Our Android patch's launcher: opens a link in one named app and resolves when the client is back. */
function upiLauncher(): UpiLauncher | null {
  const native = NativeModules.RazorpayCustomui as Partial<UpiLauncher> | undefined
  return Platform.OS === "android" && typeof native?.openUpiApp === "function" ? (native as UpiLauncher) : null
}

/**
 * iOS can't hand a `upi://` link to one chosen app, so it goes through that app's own link.
 * Codes are the ones Razorpay's iOS SDK lists; the schemes are declared in app.config.js.
 */
const IOS_UPI_PREFIXES: Record<string, string> = {
  google_pay: "tez://upi/",
  phonepe: "phonepe://",
  paytm: "paytmmp://",
  bhim: "bhim://upi/",
  cred: "credpay://upi/",
}

export function iosUpiLink(link: string, appCode: string) {
  const prefix = IOS_UPI_PREFIXES[appCode]
  return prefix && link.startsWith("upi://") ? prefix + link.slice("upi://".length) : null
}

type IntentStart = { kind: "link"; link: string } | { kind: "unsupported" } | { kind: "error"; message: string }

/**
 * Asks the server for a `upi://pay` link for this order. Servers without the route answer "unsupported".
 * `url` is the POST endpoint that takes { orderId }.
 */
async function startUpiIntent(url: string, orderId: string): Promise<IntentStart> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
    const data = (await response.json().catch(() => ({}))) as { link?: string; error?: string }
    if (response.ok && data.link?.startsWith("upi://")) return { kind: "link", link: data.link }
    // An order problem (hold ended, already paid) is the client's answer; anything else falls back.
    if (response.status === 400 && data.error) return { kind: "error", message: data.error }
    return { kind: "unsupported" }
  } catch {
    return { kind: "unsupported" }
  }
}

/** Waits until the client has left for another app and come back to ours. */
function waitForReturn(): Promise<void> {
  return new Promise((resolve) => {
    let left = AppState.currentState !== "active"
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        left = true
        return
      }
      if (!left) return
      sub.remove()
      resolve()
    })
  })
}

/** True when this phone can open a chosen UPI app directly (our Android launcher, or iOS with a known app). */
export function canPayByUpiIntent(appCode: string) {
  if (Platform.OS === "ios") return Boolean(IOS_UPI_PREFIXES[appCode])
  return upiLauncher() != null
}

/**
 * Opens the client's UPI app straight on the PIN screen, with no Razorpay screen first. The server
 * then confirms the payment with Razorpay. Returns null when this can't be done here, so the caller
 * uses another way to pay instead. Shared by advances and gift cards.
 */
export async function payWithUpiIntent(input: {
  /** The server's POST endpoint that turns { orderId } into a `upi://pay` link. */
  upiUrl: string
  orderId: string
  appCode: string
  /** Polls the server (which asks Razorpay) every 2 seconds, up to `attempts` times. */
  waitForStatus: (attempts: number) => Promise<AdvanceStatus>
  onConfirming?: () => void
}): Promise<PayOutcome | null> {
  if (!canPayByUpiIntent(input.appCode)) return null
  const android = upiLauncher()

  const started = await startUpiIntent(input.upiUrl, input.orderId)
  if (started.kind === "unsupported") return null
  if (started.kind === "error") return { kind: "not_paid", message: started.message }

  let clientGaveUp = false
  try {
    if (android) {
      const result = await android.openUpiApp(started.link, input.appCode)
      clientGaveUp = upiAppSaysNotPaid(result)
    } else {
      const url = iosUpiLink(started.link, input.appCode)
      if (!url) return null
      const back = waitForReturn()
      await Linking.openURL(url)
      await back
    }
  } catch (error) {
    const code = RECORD(error).code
    return {
      kind: "not_paid",
      message: code === "app_not_found" ? "That UPI app isn't installed. Please choose another." : "We couldn't open your UPI app. Please try again.",
    }
  }

  input.onConfirming?.()
  // UPI apps hand back before the bank has always answered, so give it up to about 30 seconds.
  // If the app says the client backed out, a short check is enough before letting them try again.
  const status = await input.waitForStatus(clientGaveUp ? 2 : 15)
  if (status === "failed" || (clientGaveUp && status === "pending")) {
    return { kind: "not_paid", message: "The payment wasn't completed. You can try again." }
  }
  return fromStatus(status) ?? { kind: "checking" }
}

/**
 * What the UPI app said when it handed back (Android). Only used to shorten the wait: the server
 * still decides, and a payment that did go through is confirmed later by the server.
 */
export function upiAppSaysNotPaid(result: { resultCode?: number; response?: string } | null) {
  // Only an explicit FAILURE counts: some UPI apps hand back nothing even when the payment worked.
  const status = /(?:^|&)status=([^&]*)/i.exec(result?.response ?? "")?.[1]?.toLowerCase()
  return status === "failure" || status === "failed"
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

async function settle(
  orderId: string,
  opened: Opened,
  waitForStatus: (attempts: number) => Promise<AdvanceStatus>,
  confirm: (proof: { orderId: string; paymentId: string; signature: string }) => Promise<PayOutcome>,
): Promise<PayOutcome> {
  if (opened.kind === "vanished" || (opened.kind === "error" && RECORD(opened.error).code === SCREEN_LOST_CODE)) {
    return fromStatus(await waitForStatus(5)) ?? { kind: "checking" }
  }

  if (opened.kind === "error") {
    // A UPI app can report a failure after the money has moved, so check before saying so.
    const known = fromStatus(await waitForStatus(2))
    if (known) return known
    const description = RECORD(opened.error).description
    return { kind: "not_paid", message: typeof description === "string" ? description : null }
  }

  const { razorpay_payment_id: paymentId, razorpay_signature: signature } = opened.result
  if (!paymentId || !signature) {
    return fromStatus(await waitForStatus(5)) ?? { kind: "checking" }
  }
  try {
    return await confirm({ orderId, paymentId, signature })
  } catch {
    // The money is in; the server confirms it (webhook or status check) if this call failed.
    return fromStatus(await waitForStatus(5)) ?? { kind: "checking" }
  }
}
