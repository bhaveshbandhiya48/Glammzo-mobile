import { useRouter, type Href } from "expo-router"
import { Pressable, StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Booking, Salon } from "@/data/types"
import { serviceSummary } from "@/lib/booking-display"
import { openDirections } from "@/lib/visit-links"
import { fontFamily } from "@/theme/tokens"

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

function dateParts(booking: Booking): { weekday: string; day: string } | null {
  const source = booking.startsAt ? new Date(booking.startsAt) : new Date(`${booking.date}T12:00:00`)
  if (Number.isNaN(source.getTime())) return null
  return { weekday: WEEKDAYS[source.getDay()] ?? "", day: String(source.getDate()) }
}

export function formatKm(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km) || km <= 0) return null
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`
}

/** Compact light "next booking" row. `salon` (from the catalog) gives distance and directions. */
export function HomeNextBookingCard({
  booking,
  salon,
  distanceKm,
}: {
  booking: Booking
  salon?: Salon
  distanceKm?: number | null
}) {
  const router = useRouter()
  const parts = dateParts(booking)
  const isArtist = booking.kind === "artist"
  const payToken = booking.paymentDeadline
    ? booking.artistPublicToken ?? booking.advanceToken
    : undefined
  const time = booking.time?.trim()
  const title = [serviceSummary(booking), time].filter(Boolean).join(" · ")
  const subtitle = [booking.salonName, formatKm(distanceKm)].filter(Boolean).join(" · ")
  const canDirect = !isArtist && !payToken

  function openBooking() {
    if (payToken) {
      router.push({ pathname: "/pay/advance/[token]", params: { token: payToken } } as Href)
      return
    }
    router.push("/(tabs)/bookings")
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${payToken ? "Complete your payment" : "Your next booking"}: ${title}, ${payToken ? "payment pending" : subtitle}`}
      onPress={openBooking}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {parts ? (
        <View style={styles.dateChip}>
          <Text style={styles.weekday}>{parts.weekday}</Text>
          <Text style={styles.day}>{parts.day}</Text>
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        <Text style={[styles.subtitle, payToken && styles.subtitlePay]} numberOfLines={1} ellipsizeMode="tail">
          {payToken ? "Payment pending" : subtitle}
        </Text>
      </View>
      {canDirect ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Directions"
          hitSlop={4}
          onPress={() =>
            openDirections({
              latitude: salon?.latitude,
              longitude: salon?.longitude,
              query: salon?.address || [booking.salonName, booking.salonArea].filter(Boolean).join(", "),
            })
          }
          style={({ pressed }) => [styles.directions, pressed && styles.darkPressed]}
        >
          <Icon name="navigate" size={18} color="#ffffff" />
        </Pressable>
      ) : payToken ? (
        <View style={styles.payPill}>
          <Text style={styles.payText}>Pay now</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ececec",
    borderRadius: 16,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pressed: {
    backgroundColor: "#f7f7f7",
  },
  dateChip: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#fff1ec",
    alignItems: "center",
    justifyContent: "center",
  },
  weekday: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.4,
    color: "#b03a26",
  },
  day: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 20,
    color: "#111111",
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: "#111111",
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: "#595959",
  },
  subtitlePay: {
    fontFamily: fontFamily.semibold,
    color: "#b03a26",
  },
  directions: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  darkPressed: {
    backgroundColor: "#333333",
  },
  payPill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  payText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: "#ffffff",
  },
})
