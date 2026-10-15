import { Image } from "expo-image"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, StyleSheet, View } from "react-native"

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Screen } from "@/components/ui/Screen"
import { Text } from "@/components/ui/Text"
import type { BookingStatus, Salon } from "@/data/types"
import {
  formatBookingDate,
  getBookingStatusLabel,
  statusBadgeColors,
} from "@/lib/booking-display"
import { fetchBookingById } from "@/lib/bookings-api"
import { getSalonByIdLive } from "@/lib/salons-api"
import { colors, radii, spacing } from "@/theme/tokens"

const PENDING_STEPS = [
  "The salon will review your booking.",
  "You'll receive confirmation once they respond.",
  "Your appointment details will remain available in your bookings.",
] as const

const CONFETTI = [
  { left: "14%", delay: 0, color: colors.coral, size: 6 },
  { left: "28%", delay: 80, color: "#F9A89A", size: 5 },
  { left: "42%", delay: 40, color: colors.sand, size: 7 },
  { left: "56%", delay: 120, color: colors.coral, size: 5 },
  { left: "70%", delay: 60, color: "#E8D5C4", size: 6 },
  { left: "84%", delay: 100, color: "#F9A89A", size: 5 },
] as const

function parseStatus(value: string | undefined): BookingStatus {
  if (
    value === "pending" ||
    value === "confirmed" ||
    value === "upcoming" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "declined" ||
    value === "expired"
  ) {
    return value
  }
  return "confirmed"
}

function confirmationCopy(status: BookingStatus) {
  switch (status) {
    case "pending":
      return {
        title: "Booking request sent",
        description:
          "Your booking request has been sent successfully. The salon will review it and confirm shortly.",
        panelTitle: "What happens next",
        panelBody: null as string | null,
        footerHint:
          "Need to change your appointment? You can cancel or reschedule once the salon confirms.",
      }
    case "declined":
    case "expired":
    case "cancelled":
      return {
        title:
          status === "cancelled"
            ? "Booking cancelled"
            : status === "expired"
              ? "Request expired"
              : "Request not accepted",
        description:
          status === "cancelled"
            ? "This appointment has been cancelled."
            : "This booking is no longer active. You can book another time anytime.",
        panelTitle: "Next steps",
        panelBody: "Browse the salon again to pick a new slot.",
        footerHint: "Need a new appointment? Book another time from Explore.",
      }
    default:
      return {
        title: "You're all set",
        description:
          "Your appointment is confirmed. We've saved the details to your account.",
        panelTitle: "You're confirmed",
        panelBody:
          "Show this booking at the salon. You can manage or cancel from your bookings anytime.",
        footerHint:
          "Need to change your appointment? You can cancel or reschedule from Manage booking.",
      }
  }
}

function SuccessConfetti() {
  const progress = useRef(new Animated.Value(0)).current
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 2400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setVisible(false))
  }, [progress])

  if (!visible) return null

  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {CONFETTI.map((particle, index) => {
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-8, 160],
        })
        const opacity = progress.interpolate({
          inputRange: [0, 0.12, 1],
          outputRange: [0, 0.9, 0],
        })
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${index % 2 === 0 ? 150 : -140}deg`],
        })
        return (
          <Animated.View
            key={index}
            style={[
              styles.confettiDot,
              {
                left: particle.left,
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                opacity,
                transform: [{ translateY }, { rotate }],
              },
            ]}
          />
        )
      })}
    </View>
  )
}

export default function BookingConfirmationScreen() {
  const router = useRouter()
  const {
    salonId,
    total,
    slot,
    name,
    bookingId,
    date,
    status: statusParam,
  } = useLocalSearchParams<{
    salonId: string
    total: string
    slot: string
    name: string
    bookingId?: string
    date?: string
    status?: string
  }>()
  const [salon, setSalon] = useState<Salon | undefined>()
  const [status, setStatus] = useState<BookingStatus>(parseStatus(statusParam))
  const [bookingDate, setBookingDate] = useState(
    typeof date === "string" ? date : "",
  )
  const [bookingTime, setBookingTime] = useState(
    typeof slot === "string" ? slot : "",
  )
  const [displayName, setDisplayName] = useState(
    typeof name === "string" ? name : "Guest",
  )
  const [displayTotal, setDisplayTotal] = useState(
    typeof total === "string" ? total : "0",
  )
  const iconScale = useRef(new Animated.Value(0.82)).current
  const iconOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start()
  }, [iconOpacity, iconScale])

  useEffect(() => {
    let active = true
    if (typeof salonId !== "string") {
      setSalon(undefined)
      return
    }
    getSalonByIdLive(salonId).then((next) => {
      if (!active) return
      setSalon(next)
    })
    return () => {
      active = false
    }
  }, [salonId])

  useEffect(() => {
    let active = true
    if (typeof bookingId !== "string" || !bookingId) return
    fetchBookingById(bookingId)
      .then((booking) => {
        if (!active || !booking) return
        setStatus(booking.status)
        setBookingDate(booking.date)
        setBookingTime(booking.time)
        setDisplayTotal(String(booking.price))
      })
      .catch(() => {
        // Keep route params if refresh fails.
      })
    return () => {
      active = false
    }
  }, [bookingId])

  const copy = useMemo(() => confirmationCopy(status), [status])
  const badge = statusBadgeColors(status)
  const isPending = status === "pending"
  const isNegative =
    status === "declined" || status === "expired" || status === "cancelled"
  const isSuccess = !isPending && !isNegative
  const bookingReference =
    typeof bookingId === "string" && bookingId
      ? bookingId.slice(0, 8).toUpperCase()
      : null
  const dateLabel = bookingDate ? formatBookingDate(bookingDate) : null

  return (
    <Screen scroll contentStyle={styles.screen}>
      {(isSuccess || isPending) && <SuccessConfetti />}

      <View style={styles.heroCard}>
        <Animated.View
          style={[
            styles.iconWrap,
            isPending && styles.iconWrapPending,
            isSuccess && styles.iconWrapSuccess,
            isNegative && styles.iconWrapNegative,
            { opacity: iconOpacity, transform: [{ scale: iconScale }] },
          ]}
        >
          <Icon
            name={isNegative ? "close-circle" : "checkmark-circle"}
            size={42}
            color={
              isPending ? "#B45309" : isNegative ? "#C2410C" : colors.success
            }
          />
        </Animated.View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: badge.bg, borderColor: badge.border },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: badge.dot }]} />
          <Text variant="caption" style={{ color: badge.text }}>
            {getBookingStatusLabel(status)}
          </Text>
        </View>

        <Text variant="title" style={styles.heroTitle}>
          {copy.title}
        </Text>
        <Text muted style={styles.heroDescription}>
          {copy.description}
        </Text>

        {isPending ? (
          <View style={styles.nextSteps}>
            <Text variant="label" muted style={styles.nextStepsTitle}>
              {copy.panelTitle}
            </Text>
            {PENDING_STEPS.map((step, index) => (
              <View key={step} style={styles.stepRow}>
                <View style={styles.stepIndex}>
                  <Text variant="caption" color={colors.coral}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.confirmedPanel,
              isNegative ? styles.confirmedPanelNegative : styles.confirmedPanelSuccess,
            ]}
          >
            <Text
              variant="label"
              style={{
                color: isNegative ? "#9A3412" : "#065F46",
                textAlign: "center",
              }}
            >
              {copy.panelTitle}
            </Text>
            {copy.panelBody ? (
              <Text muted style={styles.confirmedBody}>
                {copy.panelBody}
              </Text>
            ) : null}
            {isSuccess ? (
              <Text variant="caption" style={styles.reminderLine}>
                You’ll get SMS reminders 24h and 2h before your visit.
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.pass}>
        {salon ? (
          <Image
            source={{ uri: salon.coverImageUrl || salon.imageUrl }}
            style={styles.passCover}
            contentFit="cover"
            transition={200}
          />
        ) : null}
        <View style={styles.passBody}>
          <View style={styles.salonRow}>
            {salon ? (
              <Image
                source={{ uri: salon.imageUrl || salon.coverImageUrl }}
                style={styles.salonThumb}
                contentFit="cover"
                transition={200}
              />
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="heading" numberOfLines={1}>
                {salon?.name ?? "Salon"}
              </Text>
              <Text muted numberOfLines={1}>
                {salon?.area}
                {salon?.city ? `, ${salon.city}` : ""}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text variant="bodyStrong">{displayName || "Guest"}</Text>
          <Text muted>
            {dateLabel ? `${dateLabel} · ` : ""}
            {bookingTime || "Time TBD"}
          </Text>
          <Text variant="bodyStrong" style={styles.gap}>
            Pay at salon · ₹{displayTotal || "0"}
          </Text>
          {bookingReference ? (
            <View style={styles.refRow}>
              <Text variant="caption" muted>
                Booking ID
              </Text>
              <View style={styles.refChip}>
                <Text variant="caption">#{bookingReference}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Manage booking"
          onPress={() => router.replace("/(tabs)/bookings")}
        />
        <Button
          label={isNegative ? "Book again" : "Book another"}
          variant="secondary"
          onPress={() =>
            router.replace(
              isNegative && typeof salonId === "string"
                ? `/salon/${salonId}`
                : "/(tabs)/explore",
            )
          }
        />
        <Text variant="caption" muted style={styles.footerHint}>
          {copy.footerHint}
        </Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: spacing.lg,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFill,
    height: 180,
    zIndex: 2,
  },
  confettiDot: {
    position: "absolute",
    top: 8,
    borderRadius: radii.pill,
  },
  heroCard: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  iconWrapPending: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
  },
  iconWrapSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#6EE7B7",
  },
  iconWrapNegative: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
  },
  statusBadge: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
  },
  heroTitle: {
    marginTop: spacing.lg,
    textAlign: "center",
  },
  heroDescription: {
    marginTop: spacing.sm,
    textAlign: "center",
    maxWidth: 320,
  },
  nextSteps: {
    width: "100%",
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  nextStepsTitle: {
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepIndex: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  confirmedPanel: {
    width: "100%",
    marginTop: spacing.xl,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  confirmedPanelSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  confirmedPanelNegative: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  confirmedBody: {
    marginTop: spacing.sm,
    textAlign: "center",
  },
  reminderLine: {
    marginTop: spacing.md,
    textAlign: "center",
    color: "#065F46",
  },
  gap: {
    marginTop: spacing.sm,
  },
  pass: {
    marginTop: spacing.xxl,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  passCover: {
    width: "100%",
    height: 140,
    backgroundColor: colors.muted,
  },
  passBody: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  salonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  salonThumb: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  refRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  refChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actions: {
    marginTop: spacing.xxxl,
    gap: spacing.md,
  },
  footerHint: {
    textAlign: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
})
