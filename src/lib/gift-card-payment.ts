import { CRM_URL } from "@/lib/config"
import { payRazorpayOrder, type AdvanceStatus, type PayMethod, type PayOutcome } from "@/lib/advance-payment"

/**
 * Gift cards are paid inside the app, exactly like booking advances: UPI opens the buyer's UPI app
 * on its PIN screen (or Razorpay's in-app screen where that can't be done), net banking uses
 * Razorpay's in-app screen, and the server confirms the payment with Razorpay. Only cards, and
 * builds without the payment module, use the secure web page.
 */

function giftCardEndpoint(token: string) {
  return `${CRM_URL}/api/public/gift-cards/${encodeURIComponent(token)}`
}

/** The secure web page: cards, and builds without in-app payments. */
export function giftCardWebPageUrl(token: string) {
  return `${CRM_URL}/pay/gift/${encodeURIComponent(token)}`
}

type GiftCardOrder = { keyId: string; orderId: string; amountPaise: number; buyerPhone: string }

async function postGiftCard<T>(token: string, body: unknown): Promise<T> {
  const response = await fetch(`${giftCardEndpoint(token)}/pay`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || "Could not start the payment.")
  return data
}

async function createGiftCardOrder(token: string): Promise<GiftCardOrder> {
  const data = await postGiftCard<Partial<GiftCardOrder>>(token, {})
  if (!data.orderId || !data.keyId) throw new Error("Could not start the payment.")
  return {
    keyId: data.keyId,
    orderId: data.orderId,
    amountPaise: Number(data.amountPaise),
    buyerPhone: String(data.buyerPhone ?? ""),
  }
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

/** Pays for the gift card with UPI or net banking, inside the app. */
export async function payGiftCard(input: {
  token: string
  method: PayMethod
  email: string
  onConfirming?: () => void
}): Promise<PayOutcome> {
  let order: GiftCardOrder
  try {
    order = await createGiftCardOrder(input.token)
  } catch (error) {
    return { kind: "not_paid", message: error instanceof Error ? error.message : null }
  }
  return payRazorpayOrder({
    order: {
      keyId: order.keyId,
      orderId: order.orderId,
      amountPaise: order.amountPaise,
      description: "Glammzo gift card",
      contact: order.buyerPhone,
    },
    method: input.method,
    email: input.email,
    upiUrl: `${giftCardEndpoint(input.token)}/upi`,
    waitForStatus: (attempts) => waitForGiftCardStatus(input.token, attempts),
    confirm: async (proof) => {
      await postGiftCard(input.token, proof)
      return { kind: "paid" }
    },
    onConfirming: input.onConfirming,
  })
}
