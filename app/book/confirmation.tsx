import { Image } from "expo-image"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, Linking, StyleSheet, View } from "react-native"

import { ShareArtistInvoiceButton } from "@/components/bookings/ShareArtistInvoiceButton"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Screen } from "@/components/ui/Screen"
import { Text } from "@/components/ui/Text"
import type { Booking, BookingStatus, Salon } from "@/data/types"
import {
  bookingDurationMin,
  formatBookingDate,
  formatDuration,
  getBookingStatusLabel,
  statusBadgeColors,
} from "@/lib/booking-display"
import { fetchBookingById } from "@/lib/bookings-api"
import { getSalonByIdLive } from "@/lib/salons-api"
import { directionsUrl, googleCalendarUrl, visitStart } from "@/lib/visit-links"
import { colors, radii, spacing } from "@/theme/tokens"

const PENDING_STEPS_SALON = [
  "The salon will review your booking.",
  "You'll get a confirmation once they respond.",
  "You can track or cancel the visit from My bookings.",
] as const

const PENDING_STEPS_ARTIST = [
  "Your visit is held with the artist.",
  "You'll get reminders before the appointment.",
  "You can cancel from My bookings (at least 2 hours before).",
] as const

const CONFETTI = [
  { left: "14%", delay: 0, color: colors.primary, size: 6 },
  { left: "28%", delay: 80, color: "#BDBDBD", size: 5 },
  { left: "42%", delay: 40, color: colors.sand, size: 7 },
  { left: "56%", delay: 120, color: colors.primary, size: 5 },
  { left: "70%", delay: 60, color: "#D4D4D4", size: 6 },
  { left: "84%", delay: 100, color: "#BDBDBD", size: 5 },
] as const

function firstParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

function parseStatus(value: string | null | undefined): BookingStatus {
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

function confirmationCopy(status: BookingStatus, artist: boolean) {
  const provider = artist ? "artist" : "salon"
  switch (status) {
    case "pending":
      return {
        title: artist ? "Booking requested" : "Booking request sent",
        description: artist
          ? "Your visit request is in. Details are saved to your account."
          : "Your request is with the salon. They’ll confirm shortly.",
        panelTitle: "What happens next",
        footerHint: artist
          ? "Need to change plans? Cancel from My bookings at least 2 hours before."
          : "Need to change your appointment? You can cancel or reschedule once the salon confirms.",
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
        footerHint: `Need a new appointment? Book again from the ${provider} page.`,
      }
    default:
      return {
        title: "You're booked",
        description: artist
          ? "Your solo-artist visit is confirmed. We’ve saved the details to your account."
          : "Your appointment is confirmed. We’ve saved the details to your account.",
        panelTitle: "You’re confirmed",
        footerHint: artist
          ? "Need to change plans? Cancel from My bookings at least 2 hours before."
          : "Need to change your appointment? Cancel or reschedule from My bookings.",
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

function PassRow({
  label,
  value,
  subvalue,
  last,
}: {
  label: string
  value: string
  subvalue?: string | null
  last?: boolean
}) {
  return (
    <View style={[styles.passRow, last && styles.passRowLast]}>
      <Text variant="label" muted style={styles.passLabel}>
        {label}
      </Text>
      <View style={styles.passValueCol}>
        <Text variant="bodyStrong" style={styles.passValue}>
          {value}
        </Text>
        {subvalue ? (
          <Text variant="caption" muted style={styles.passSub}>
            {subvalue}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

export default function BookingConfirmationScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    salonId?: string | string[]
    total?: string | string[]
    slot?: string | string[]
    name?: string | string[]
    bookingId?: string | string[]
    date?: string | string[]
    status?: string | string[]
    kind?: string | string[]
    services?: string | string[]
    visitType?: string | string[]
    area?: string | string[]
    providerName?: string | string[]
    photoUrl?: string | string[]
    /** Artist advance still to pay (Glammzo web payment page). */
    payUrl?: string | string[]
  }>()

  const salonId = firstParam(params.salonId)
  const bookingId = firstParam(params.bookingId)
  const kindParam = firstParam(params.kind)
  const isArtist =
    kindParam === "artist" ||
    Boolean(bookingId?.startsWith("artist:"))

  const [salon, setSalon] = useState<Salon | undefined>()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [status, setStatus] = useState<BookingStatus>(
    parseStatus(firstParam(params.status)),
  )
  const [bookingDate, setBookingDate] = useState(firstParam(params.date) ?? "")
  const [bookingTime, setBookingTime] = useState(firstParam(params.slot) ?? "")
  const [displayName, setDisplayName] = useState(firstParam(params.name) ?? "Guest")
  const [displayTotal, setDisplayTotal] = useState(firstParam(params.total) ?? "0")
  const [servicesLine, setServicesLine] = useState(firstParam(params.services) ?? "")
  const [visitType, setVisitType] = useState(firstParam(params.visitType) ?? "")
  const [areaLine, setAreaLine] = useState(firstParam(params.area) ?? "")
  const [providerName, setProviderName] = useState(
    firstParam(params.providerName) ?? "",
  )
  const [photoUrl, setPhotoUrl] = useState(firstParam(params.photoUrl) ?? "")

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
    if (isArtist || !salonId) {
      setSalon(undefined)
      return
    }
    getSalonByIdLive(salonId).then((next) => {
      if (!active) return
      setSalon(next)
      if (next) {
        setAreaLine([next.area, next.city].filter(Boolean).join(", "))
        setProviderName(next.name)
        setPhotoUrl(next.imageUrl || next.coverImageUrl || "")
      }
    })
    return () => {
      active = false
    }
  }, [salonId, isArtist])

  useEffect(() => {
    let active = true
    if (!bookingId || isArtist) return
    fetchBookingById(bookingId)
      .then((next) => {
        if (!active || !next) return
        setBooking(next)
        setStatus(next.status)
        setBookingDate(next.date)
        setBookingTime(next.time)
        setDisplayTotal(String(next.price))
        if (next.services.length > 0) {
          setServicesLine(next.services.map((s) => s.name).join(" · "))
        }
        if (next.salonName) setProviderName(next.salonName)
        if (next.salonArea) setAreaLine(next.salonArea)
      })
      .catch(() => {
        // Keep route params if refresh fails.
      })
    return () => {
      active = false
    }
  }, [bookingId, isArtist])

  const copy = useMemo(
    () => confirmationCopy(status, isArtist),
    [status, isArtist],
  )
  const badge = statusBadgeColors(status)
  const isPending = status === "pending"
  const isNegative =
    status === "declined" || status === "expired" || status === "cancelled"
  const isSuccess = !isPending && !isNegative
  const bookingReference =
    bookingId && !bookingId.startsWith("artist:")
      ? bookingId.slice(0, 8).toUpperCase()
      : bookingId?.startsWith("artist:")
        ? bookingId.replace(/^artist:/, "").slice(0, 8).toUpperCase()
        : null
  const dateLabel = bookingDate ? formatBookingDate(bookingDate) : null
  const durationMin = booking ? bookingDurationMin(booking) : 0
  const staffLabel = isArtist
    ? providerName || "Solo artist"
    : booking?.staffName?.trim() || "Any available"
  const titleName = providerName || salon?.name || (isArtist ? "Solo artist" : "Salon")
  const coverUri = salon?.coverImageUrl || salon?.imageUrl || photoUrl || null
  const thumbUri = photoUrl || salon?.imageUrl || salon?.coverImageUrl || null
  const pendingSteps = isArtist ? PENDING_STEPS_ARTIST : PENDING_STEPS_SALON
  const payLabel = isArtist ? "Pay artist directly" : "Pay at salon"
  const artistInvoiceBooking: Booking | null = isArtist
    ? {
        id: bookingId || `artist:${salonId || "booking"}`,
        salonId: salonId || "",
        salonName: titleName,
        salonArea: areaLine || visitType || "Visit",
        services: servicesLine
          ? servicesLine.split(" · ").map((name, index) => ({
              id: `svc-${index}`,
              name: name.trim() || "Service",
              price: Number(displayTotal) || 0,
              durationMin: 0,
            }))
          : [
              {
                id: "svc-0",
                name: "Service",
                price: Number(displayTotal) || 0,
                durationMin: 0,
              },
            ],
        date: bookingDate,
        time: bookingTime,
        price: Number(displayTotal) || 0,
        durationMin: 0,
        notes: visitType || areaLine || "Visit",
        status,
        createdAt: new Date().toISOString(),
        kind: "artist",
        artistSlug: salonId || undefined,
        artistPublicToken: bookingId?.replace(/^artist:/, "") || undefined,
      }
    : null

  return (
    <Screen scroll contentStyle={styles.screen}>
      {(isSuccess || isPending) && <SuccessConfetti />}

      <View style={styles.hero}>
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
            size={40}
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
      </View>

      <View style={styles.pass}>
        {coverUri && !isArtist ? (
          <Image
            source={{ uri: coverUri }}
            style={styles.passCover}
            contentFit="cover"
            transition={200}
          />
        ) : null}

        <View style={styles.passBody}>
          <View style={styles.providerRow}>
            {thumbUri ? (
              <Image
                source={{ uri: thumbUri }}
                style={styles.providerThumb}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.providerThumb, styles.providerThumbFallback]}>
                <Icon
                  name={isArtist ? "sparkles-outline" : "storefront-outline"}
                  size={22}
                  color={colors.primary}
                />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View style={styles.kindRow}>
                <Text variant="caption" color={colors.primary}>
                  {isArtist ? "Solo artist" : "Salon"}
                </Text>
              </View>
              <Text variant="heading" numberOfLines={2}>
                {titleName}
              </Text>
              <Text muted numberOfLines={2}>
                {[areaLine || salon?.area, visitType].filter(Boolean).join(" · ") ||
                  "—"}
              </Text>
            </View>
          </View>

          <View style={styles.passDetails}>
            <PassRow label="Date" value={dateLabel || "Date TBD"} />
            <PassRow
              label="Time"
              value={bookingTime || "Time TBD"}
              subvalue={
                durationMin > 0 ? `About ${formatDuration(durationMin)}` : null
              }
            />
            <PassRow label="Guest" value={displayName || "Guest"} />
            <PassRow
              label={isArtist ? "Artist" : "Stylist"}
              value={staffLabel}
            />
            {servicesLine ? (
              <PassRow label="Services" value={servicesLine} />
            ) : null}
            <PassRow
              label="Total"
              value={`₹${displayTotal || "0"}`}
              subvalue={payLabel}
              last
            />
          </View>

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

      {(isPending || isSuccess) && (
        <View style={styles.nextCard}>
          <Text variant="label" muted style={styles.nextTitle}>
            {copy.panelTitle}
          </Text>
          {isPending && firstParam(params.payUrl) ? (
            <View style={{ gap: 6, marginBottom: 12 }}>
              <Text variant="caption" muted>
                Your booking is confirmed once the advance is paid. The time is held for 15 minutes.
              </Text>
              <Button label="Pay advance" onPress={() => void Linking.openURL(firstParam(params.payUrl)!)} />
            </View>
          ) : null}
          {isPending ? (
            <View style={styles.steps}>
              {pendingSteps.map((step, index) => (
                <View key={step} style={styles.stepRow}>
                  <View style={styles.stepIndex}>
                    <Text variant="caption" color={colors.primary}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.tips}>
              <View style={styles.tipRow}>
                <Icon name="notifications-outline" size={18} color={colors.primary} />
                <Text style={styles.tipText}>
                  SMS reminders 24h and 2h before your visit.
                </Text>
              </View>
              <View style={styles.tipRow}>
                <Icon name="calendar-outline" size={18} color={colors.primary} />
                <Text style={styles.tipText}>
                  Find this appointment anytime under My bookings.
                </Text>
              </View>
              {!isArtist ? (
                <View style={styles.tipRow}>
                  <Icon name="card-outline" size={18} color={colors.primary} />
                  <Text style={styles.tipText}>
                    Pay at the salon after your service.
                  </Text>
                </View>
              ) : (
                <View style={styles.tipRow}>
                  <Icon name="cash-outline" size={18} color={colors.primary} />
                  <Text style={styles.tipText}>
                    Pay the artist directly for this visit.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {isNegative ? (
        <View style={styles.negativeCard}>
          <Text variant="bodyStrong">Book another time</Text>
          <Text muted style={{ marginTop: spacing.xs }}>
            Browse again and pick a new slot that works for you.
          </Text>
        </View>
      ) : null}

      {!isNegative && (isPending || isSuccess) ? (
        <VisitLinks
          title={`${servicesLine || "Appointment"} at ${providerName || salon?.name || "Glammzo"}`}
          place={providerName || salon?.name || ""}
          address={salon?.address || areaLine}
          latitude={salon?.latitude}
          longitude={salon?.longitude}
          start={visitStart(bookingDate, bookingTime, booking?.startsAt)}
          durationMin={booking?.durationMin ?? 60}
          homeVisit={/home/i.test(visitType)}
        />
      ) : null}

      <View style={styles.actions}>
        {artistInvoiceBooking && !isNegative ? (
          <ShareArtistInvoiceButton booking={artistInvoiceBooking} />
        ) : null}
        <Button
          label="View my bookings"
          onPress={() => router.replace("/(tabs)/bookings")}
        />
        <Button
          label={isNegative ? "Book again" : "Done"}
          variant="secondary"
          onPress={() => {
            if (isNegative && salonId) {
              router.replace(
                isArtist
                  ? { pathname: "/artist/[slug]", params: { slug: salonId } }
                  : { pathname: "/salon/[id]", params: { id: salonId } },
              )
              return
            }
            if (isArtist && salonId) {
              router.replace({
                pathname: "/artist/[slug]",
                params: { slug: salonId },
              })
              return
            }
            router.replace("/(tabs)/explore")
          }}
        />
        <Text variant="caption" muted style={styles.footerHint}>
          {copy.footerHint}
        </Text>
      </View>
    </Screen>
  )
}

/** Add to calendar and directions, side by side. */
function VisitLinks(props: {
  title: string
  place: string
  address: string
  latitude?: number
  longitude?: number
  start: Date | null
  durationMin: number
  homeVisit: boolean
}) {
  const location = [props.place, props.address].filter(Boolean).join(", ")
  return (
    <View style={styles.linkRow}>
      {props.start ? (
        <Button
          label="Add to calendar"
          variant="secondary"
          style={styles.linkBtn}
          onPress={() =>
            void Linking.openURL(
              googleCalendarUrl({
                title: props.title,
                start: props.start!,
                durationMin: props.durationMin,
                location: props.homeVisit ? undefined : location,
                details: "Booked on Glammzo. Manage it under My bookings.",
              }),
            )
          }
        />
      ) : null}
      {!props.homeVisit && location ? (
        <Button
          label="Directions"
          variant="secondary"
          style={styles.linkBtn}
          onPress={() =>
            void Linking.openURL(
              directionsUrl({ latitude: props.latitude, longitude: props.longitude, query: location }),
            )
          }
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  linkRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  linkBtn: {
    flex: 1,
  },
  screen: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
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
  hero: {
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xl,
  },
  iconWrap: {
    width: 68,
    height: 68,
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
    lineHeight: 22,
  },
  pass: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  passCover: {
    width: "100%",
    height: 120,
    backgroundColor: colors.muted,
  },
  passBody: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  providerThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  providerThumbFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F1F1",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D4D4D4",
  },
  kindRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  passDetails: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  passRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  passRowLast: {
    borderBottomWidth: 0,
  },
  passLabel: {
    width: 72,
    marginTop: 2,
    fontSize: 10,
  },
  passValueCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  passValue: {
    textAlign: "left",
  },
  passSub: {
    lineHeight: 18,
  },
  refRow: {
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
  nextCard: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.md,
  },
  nextTitle: {
    textAlign: "left",
  },
  steps: {
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
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
  tips: {
    gap: spacing.md,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  negativeCard: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FED7AA",
    backgroundColor: "#FFF7ED",
  },
  actions: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  footerHint: {
    textAlign: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
})
