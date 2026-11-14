import { StyleSheet, View } from "react-native"

import { sp } from "@/components/salon-page/theme"
import { Text } from "@/components/ui/Text"
import type { Booking } from "@/data/types"
import { formatRupees } from "@/lib/service-pricing"
import { fontFamily } from "@/theme/tokens"

function formatWhen(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
}

/** "You get ₹750 of ₹750 back" before the client confirms a cancellation. */
export function RefundPreview({ booking }: { booking: Booking }) {
  const preview = booking.cancelRefund
  if (!preview) return null
  const none = preview.refund <= 0
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`If you cancel now you get ${formatRupees(preview.refund)} of your ${formatRupees(preview.advance)} advance back.`}
    >
      <Text style={styles.label}>If you cancel now</Text>
      <Text style={styles.amount}>
        {none ? "No refund" : `${formatRupees(preview.refund)} back`}
        <Text style={styles.of}>{` of your ${formatRupees(preview.advance)} advance`}</Text>
      </Text>
      {preview.nextChangeAt && preview.nextRefund != null ? (
        <Text style={styles.note}>
          {preview.nextRefund > 0
            ? `Cancel after ${formatWhen(preview.nextChangeAt)} and you get ${formatRupees(preview.nextRefund)} back.`
            : `No refund if you cancel after ${formatWhen(preview.nextChangeAt)}.`}
        </Text>
      ) : null}
      <Text style={styles.note}>
        {none
          ? `${preview.policy} cancellation policy.`
          : `Back to the way you paid within 5 to 7 working days. ${preview.policy} cancellation policy.`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 14, gap: 4, backgroundColor: sp.peachBg },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: sp.peachInk,
  },
  amount: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, color: sp.peachInk },
  of: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: sp.peachInk },
  note: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: sp.peachInk },
})
