import { useRouter, type Href } from "expo-router"
import { StyleSheet, View } from "react-native"

import { ActionPill } from "@/components/bookings/BookingPills"
import { formatHoldLeft, useHoldCountdown } from "@/components/payments/useHoldCountdown"
import { sp } from "@/components/salon-page/theme"
import { Text } from "@/components/ui/Text"
import type { Booking } from "@/data/types"
import { formatRupees } from "@/lib/service-pricing"
import { fontFamily } from "@/theme/tokens"

/** Booking token when an advance is still due and the slot is still held. */
export function advanceDueToken(booking: Booking): string | null {
  // Artists: the booking's public token. Pro salons: a signed advance token.
  const token = booking.kind === "artist" ? booking.artistPublicToken : booking.advanceToken
  if (!token || !booking.paymentDeadline) return null
  if (new Date(booking.paymentDeadline).getTime() <= Date.now()) return null
  return token
}

/** Peach "slot held" strip with a Pay pill; hidden once paid or the hold runs out. */
export function BookingPayStrip({ booking, onExpired }: { booking: Booking; onExpired?: () => void }) {
  const router = useRouter()
  const token = advanceDueToken(booking)
  const left = useHoldCountdown(booking.paymentDeadline, onExpired)
  if (!token || left == null || left <= 0) return null
  const amount = formatRupees(booking.advanceAmount ?? 0)
  return (
    <View style={styles.strip} accessibilityLabel={`Payment pending. Slot held for ${formatHoldLeft(left)}`}>
      <Text style={styles.text}>
        Slot held for {formatHoldLeft(left)}. Pay {amount} to confirm.
      </Text>
      <ActionPill
        label={`Pay ${amount}`}
        onPress={() => router.push({ pathname: "/pay/advance/[token]", params: { token } } as Href)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: sp.peachBg,
  },
  text: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: sp.peachInk,
  },
})
