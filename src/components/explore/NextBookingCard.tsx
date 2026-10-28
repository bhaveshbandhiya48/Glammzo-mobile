import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Booking } from "@/data/types"
import { fetchBookings } from "@/lib/bookings-api"
import { formatBookingWhen, getBookingStatusLabel, serviceSummary } from "@/lib/booking-display"
import { getAccessToken } from "@/lib/session"
import { colors, radii, spacing } from "@/theme/tokens"

const ACTIVE = new Set(["pending", "confirmed", "upcoming"])

/** Soonest upcoming booking that is still on (pending or confirmed). */
function pickNext(bookings: Booking[], now = Date.now()): Booking | null {
  const upcoming = bookings
    .filter((b) => ACTIVE.has(b.status))
    .map((b) => ({ b, at: b.startsAt ? Date.parse(b.startsAt) : Date.parse(`${b.date}T23:59:00`) }))
    .filter(({ at }) => Number.isFinite(at) && at >= now)
    .sort((a, b) => a.at - b.at)
  return upcoming[0]?.b ?? null
}

/**
 * The one dark "what's next" card on Home (Partner app pattern). Renders
 * nothing when signed out or when there is no upcoming visit.
 */
export function NextBookingCard() {
  const router = useRouter()
  const [next, setNext] = useState<Booking | null>(null)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        if (!(await getAccessToken())) {
          if (!cancelled) setNext(null)
          return
        }
        try {
          const bookings = await fetchBookings()
          if (!cancelled) setNext(pickNext(bookings))
        } catch {
          // Home must never fail because of this card.
        }
      })()
      return () => {
        cancelled = true
      }
    }, []),
  )

  if (!next) return null

  const awaitingPayment = Boolean(next.paymentDeadline)
  const label = awaitingPayment ? "Pay the advance to confirm" : getBookingStatusLabel(next.status)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Your next visit: ${next.salonName}, ${formatBookingWhen(next)}. ${label}. Open bookings.`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push("/(tabs)/bookings")}
    >
      <View style={styles.top}>
        <Text variant="label" color={colors.accent}>
          Your next visit
        </Text>
        <View style={styles.pill}>
          <Text variant="caption" color={colors.primaryFg}>
            {label}
          </Text>
        </View>
      </View>
      <Text variant="heading" color={colors.primaryFg} numberOfLines={1}>
        {next.salonName}
      </Text>
      <Text variant="bodyStrong" color={colors.primaryFg}>
        {formatBookingWhen(next)}
      </Text>
      <View style={styles.bottom}>
        <Text variant="caption" color={colors.accent} numberOfLines={1} style={{ flex: 1 }}>
          {[serviceSummary(next), next.kind === "artist" ? null : next.staffName].filter(Boolean).join(" · ")}
        </Text>
        <Icon name="chevron-forward" size={18} color={colors.primaryFg} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.hero,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: 6,
  },
  pressed: {
    backgroundColor: colors.primaryPressed,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  pill: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
})
