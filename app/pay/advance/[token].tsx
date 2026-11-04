import { useLocalSearchParams, useRouter, type Href } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { View } from "react-native"

import { AdvancePaymentSheet } from "@/components/payments/AdvancePaymentSheet"

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/** Time for the sheet to slide away before the route underneath changes. */
const CLOSE_MS = 220

/** Opens the payment sheet over whichever screen the client is on (Bookings, confirmation). */
export default function PayAdvanceScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ token: string; next?: string }>()
  const token = firstParam(params.token) ?? ""
  const nextRaw = firstParam(params.next)
  const [visible, setVisible] = useState(true)

  const next = useMemo(() => {
    if (!nextRaw) return null
    try {
      return JSON.parse(nextRaw) as Record<string, string>
    } catch {
      return null
    }
  }, [nextRaw])

  /** Back on the confirmation screen when we came from booking, otherwise wherever the client was. */
  const leave = useCallback(
    (status: "pending" | "confirmed", paidRupees?: number) => {
      if (next) {
        router.replace({
          pathname: "/book/confirmation",
          params: {
            ...next,
            status,
            ...(status === "confirmed" && paidRupees != null ? { advancePaid: String(paidRupees) } : {}),
          },
        } as Href)
      } else if (router.canGoBack()) {
        router.back()
      } else {
        router.replace("/(tabs)/bookings" as Href)
      }
    },
    [next, router],
  )

  return (
    <View style={{ flex: 1 }}>
      <AdvancePaymentSheet
        visible={visible}
        token={token}
        onPaid={(paid) => leave("confirmed", paid)}
        onClose={() => {
          setVisible(false)
          setTimeout(() => leave("pending"), CLOSE_MS)
        }}
      />
    </View>
  )
}
