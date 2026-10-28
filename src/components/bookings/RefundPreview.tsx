import { StyleSheet, View } from "react-native"

import { Text } from "@/components/ui/Text"
import type { Booking } from "@/data/types"
import { formatRupees } from "@/lib/service-pricing"
import { radii, spacing, status as tint } from "@/theme/tokens"

function formatWhen(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
}

/** "You get ₹750 of ₹750 back" before the client confirms a cancellation. */
export function RefundPreview({ booking }: { booking: Booking }) {
  const preview = booking.cancelRefund
  if (!preview) return null
  const full = preview.refund >= preview.advance
  const none = preview.refund <= 0
  return (
    <View
      style={[styles.card, { backgroundColor: none ? tint.dangerBg : full ? tint.successBg : tint.warnBg }]}
      accessible
      accessibilityLabel={`If you cancel now you get ${formatRupees(preview.refund)} of your ${formatRupees(preview.advance)} advance back.`}
    >
      <Text variant="label" color={none ? tint.dangerFg : full ? tint.successFg : tint.warnFg}>
        If you cancel now
      </Text>
      <Text variant="heading">
        {none ? "No refund" : `${formatRupees(preview.refund)} back`}
        <Text variant="body" muted>{` of your ${formatRupees(preview.advance)} advance`}</Text>
      </Text>
      {preview.nextChangeAt && preview.nextRefund != null ? (
        <Text variant="caption" muted>
          {preview.nextRefund > 0
            ? `Cancel after ${formatWhen(preview.nextChangeAt)} and you get ${formatRupees(preview.nextRefund)} back.`
            : `No refund if you cancel after ${formatWhen(preview.nextChangeAt)}.`}
        </Text>
      ) : null}
      <Text variant="caption" muted>
        {none
          ? `${preview.policy} cancellation policy.`
          : `Back to the way you paid within 5 to 7 working days. ${preview.policy} cancellation policy.`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
  },
})

