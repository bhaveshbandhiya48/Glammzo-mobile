import { CRM_URL } from "@/lib/config"
import { canPayByUpiIntent, payWithUpiIntent, type AdvanceStatus, type PayOutcome } from "@/lib/advance-payment"

/**
 * Gift cards paid straight in the buyer's UPI app, the same way as booking advances: the server
 * makes the UPI payment, the app opens the UPI app on its PIN screen, and the server confirms it
 * with Razorpay. Cards and net banking still use the secure web page.
 */

function giftCardEndpoint(token: string) {
  return `${CRM_URL}/api/public/gift-cards/${encodeURIComponent(token)}`
}

/** The secure web page: cards, net banking, and phones that can't open a UPI app directly. */
export function giftCardWebPageUrl(token: string) {
  return `${CRM_URL}/pay/gift/${encodeURIComponent(token)}`
}

type GiftCardOrder = { orderId: string; amountPaise: number }

async function createGiftCardOrder(token: string): Promise<GiftCardOrder> {
  const response = await fetch(`${giftCardEndpoint(token)}/pay`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: "{}",
  })
  const data = (await response.json().catch(() => ({}))) as Partial<GiftCardOrder> & { error?: string }
  if (!response.ok || !data.orderId) throw new Error(data.error || "Could not start the payment.")
  return { orderId: data.orderId, amountPaise: Number(data.amountPaise) }
}

/** Asks the server, which asks Razorpay, whether the card is paid. */
async function checkGiftCardStatus(token: string): Promise<AdvanceStatus> {
  try {
    const response = await fetch(`${giftCardEndpoint(token)}/status`, { headers: { Accept: "application/json" } })
    if (!response.ok) return "pending"
    const status = ((await response.json()) as { status?: string }).status
    return status === "paid" || status === "failed" ? status : "pending"
  } catch {
    return "pending"
  }
}

async function waitForGiftCardStatus(token: string, attempts: number): Promise<AdvanceStatus> {
  let status: AdvanceStatus = "pending"
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 2000))
    status = await checkGiftCardStatus(token)
    if (status !== "pending") break
  }
  return status
}

/**
 * Pays for the gift card in the chosen UPI app. Returns null when this phone or server can't open
 * the UPI app directly, so the caller opens the web page instead.
 */
export async function payGiftCardByUpi(input: {
  token: string
  appCode: string
  onConfirming?: () => void
}): Promise<PayOutcome | null> {
  if (!canPayByUpiIntent(input.appCode)) return null
  let order: GiftCardOrder
  try {
    order = await createGiftCardOrder(input.token)
  } catch (error) {
    return { kind: "not_paid", message: error instanceof Error ? error.message : null }
  }
  return payWithUpiIntent({
    upiUrl: `${giftCardEndpoint(input.token)}/upi`,
    orderId: order.orderId,
    appCode: input.appCode,
    waitForStatus: (attempts) => waitForGiftCardStatus(input.token, attempts),
    onConfirming: input.onConfirming,
  })
}
