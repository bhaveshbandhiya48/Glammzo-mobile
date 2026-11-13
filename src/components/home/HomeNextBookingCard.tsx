import { useRouter, type Href } from "expo-router"
import { Pressable, StyleSheet, View } from "react-native"

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

/** Dark "next booking" card. `salon` (from the catalog) gives distance and directions. */
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
      accessibilityLabel={`${payToken ? "Complete your payment" : "Your next booking"}: ${title}, ${subtitle}`}
      onPress={openBooking}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {parts ? (
        <View style={styles.dateBlock}>
          <Text style={styles.weekday}>{parts.weekday}</Text>
          <Text style={styles.day}>{parts.day}</Text>
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {payToken ? "Payment pending · tap to pay" : subtitle}
        </Text>
      </View>
      {canDirect ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Directions to ${booking.salonName}`}
          hitSlop={6}
          onPress={() =>
            openDirections({
              latitude: salon?.latitude,
              longitude: salon?.longitude,
              query: salon?.address || [booking.salonName, booking.salonArea].filter(Boolean).join(", "),
            })
          }
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        >
          <Text style={styles.pillText}>Directions</Text>
        </Pressable>
      ) : payToken ? (
        <View style={styles.pill}>
          <Text style={styles.pillText}>Pay now</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#111111",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pressed: {
    backgroundColor: "#2b2b2b",
  },
  dateBlock: {
    width: 44,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
  },
  weekday: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.6,
    color: "#fbd0c9",
  },
  day: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 22,
    color: "#ffffff",
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
    color: "#ffffff",
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: "#bdbdbd",
  },
  pill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  pillPressed: {
    backgroundColor: "#e5e5e5",
  },
  pillText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: "#111111",
  },
})
