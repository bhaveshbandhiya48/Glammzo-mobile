import { useRouter, type Href } from "expo-router"
import { useEffect, useRef } from "react"
import { Alert, AppState } from "react-native"

import { isPaymentInFlight, waitForAdvanceStatus } from "@/lib/advance-payment"
import { clearPendingPayment, readPendingPayment } from "@/lib/pending-payment"

export function showAdvancePaidAlert(onView?: () => void) {
  Alert.alert(
    "Payment received",
    "Your advance is paid and your booking is confirmed.",
    onView ? [{ text: "Close", style: "cancel" }, { text: "View bookings", onPress: onView }] : [{ text: "OK" }],
  )
}

export function showAdvanceRefundAlert() {
  Alert.alert(
    "Payment received after the hold ended",
    "Your time slot was released before the payment came in, so we'll refund it in full.",
  )
}

/**
 * Finishes a payment the app lost track of. If Android closed Glammzo while the client was in their
 * UPI app, nothing is waiting for Razorpay's answer when they come back. On every start and every
 * return to the app we ask the server about the last payment started, and tell the client once it
 * has gone through.
 */
export function PendingPaymentWatcher() {
  const router = useRouter()
  const running = useRef(false)

  useEffect(() => {
    const check = async () => {
      if (running.current || isPaymentInFlight()) return
      running.current = true
      try {
        const pending = await readPendingPayment()
        if (!pending) return
        const status = await waitForAdvanceStatus(pending.token, 3)
        // A payment the client started while we were checking answers for itself.
        if (isPaymentInFlight()) return
        if (status === "pending") return
        await clearPendingPayment(pending.token)
        if (status === "paid") showAdvancePaidAlert(() => router.push("/(tabs)/bookings" as Href))
        else if (status === "refunding") showAdvanceRefundAlert()
      } finally {
        running.current = false
      }
    }
    void check()
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check()
    })
    return () => sub.remove()
  }, [router])

  return null
}
