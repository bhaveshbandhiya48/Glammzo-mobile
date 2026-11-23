import { Image } from "expo-image"
import { Stack, useLocalSearchParams, usePreventRemove, useRouter, type Href } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GradientFill } from "@/components/home/GradientFill"
import { PastelIcon, type Pastel } from "@/components/profile/ProfileParts"
import { PrimaryPill, StatusPill } from "@/components/profile/ProfileScreenParts"
import { pastels, ui } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Booking, BookingStatus, Salon } from "@/data/types"
import {
  bookingDurationMin,
  formatBookingDate,
  formatDuration,
  getBookingStatusLabel,
} from "@/lib/booking-display"
import { fetchBookingById } from "@/lib/bookings-api"
import { getSalonByIdLive } from "@/lib/salons-api"
import { googleCalendarUrl, openDirections, visitStart } from "@/lib/visit-links"
import { formatRupees } from "@/lib/service-pricing"
import { colors, fontFamily } from "@/theme/tokens"

const INK = "#111111"
const SECONDARY = "#595959"
const BORDER = "#e3e3e3"

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
  { left: "28%", delay: 80, color: "#ffc9b5", size: 6 },
  { left: "42%", delay: 40, color: "#a9dfc4", size: 7 },
  { left: "56%", delay: 120, color: colors.primary, size: 5 },
  { left: "70%", delay: 60, color: "#d3c4ff", size: 6 },
  { left: "84%", delay: 100, color: "#f9c6db", size: 5 },
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
    value === "expired" ||
    value === "payment_failed"
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
    case "payment_failed":
      return {
        title: "Payment failed",
        description: "The advance wasn't paid in time, so this slot was released.",
        panelTitle: "Next steps",
        footerHint: `Still want this visit? Book again from the ${provider} page.`,
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
      <Text style={styles.passLabel}>{label}</Text>
      <View style={styles.passValueCol}>
        <Text style={[styles.passValue, last && styles.passValueTotal]}>{value}</Text>
        {subvalue ? <Text style={styles.passSub}>{subvalue}</Text> : null}
      </View>
    </View>
  )
}

export default function BookingConfirmationScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const allowLeaveRef = useRef(false)
  const [guardBack, setGuardBack] = useState(true)
  const disablePreventionRef = useRef<() => void>(() => {})
  /** Lets the next navigation leave this screen (the back guard below stays out of the way). */
  const allowLeave = useCallback(() => {
    allowLeaveRef.current = true
    setGuardBack(false)
    disablePreventionRef.current()
  }, [])
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
    /** Advance the client just paid in the app (rupees). */
    advancePaid?: string | string[]
    /** Artist advance still to pay: the booking token for the in-app payment screen. */
    payToken?: string | string[]
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

  /** Flipkart-style: leave confirmation to Home / Bookings — never back into checkout. */
  const leaveTo = useCallback(
    (href: "/(tabs)/explore" | "/(tabs)/bookings") => {
      allowLeave()
      router.replace(href)
    },
    [allowLeave, router],
  )

  // Back (gesture or button) never returns into checkout: it goes to Explore instead.
  disablePreventionRef.current = usePreventRemove(guardBack, ({ repeat }) => {
    if (allowLeaveRef.current) {
      disablePreventionRef.current()
      repeat()
      return
    }
    leaveTo("/(tabs)/explore")
  })

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
  const isPending = status === "pending"
  const isNegative =
    status === "declined" || status === "expired" || status === "cancelled" || status === "payment_failed"
  const isSuccess = !isPending && !isNegative
  const headerTitle = isNegative
    ? "Booking update"
    : isPending
      ? "Request sent"
      : "Booking confirmed"
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
  const thumbUri = photoUrl || salon?.imageUrl || salon?.coverImageUrl || null
  const pendingSteps = isArtist ? PENDING_STEPS_ARTIST : PENDING_STEPS_SALON
  const advancePaid = Number(firstParam(params.advancePaid) ?? 0)
  const payLabel =
    advancePaid > 0
      ? `${formatRupees(advancePaid)} advance paid · ${formatRupees(Math.max(0, Number(displayTotal) - advancePaid))} at the ${isArtist ? "visit" : "salon"}`
      : isArtist
        ? "Pay artist directly"
        : "Pay at salon"
  const discountRupees = booking?.glammzoDiscountRupees ?? 0
  const payLabelWithCashback =
    discountRupees > 0 ? `${payLabel} · ${formatRupees(discountRupees)} Glammzo offer discount included` : payLabel

  return (
    <View style={styles.page}>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: true,
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to home"
              hitSlop={10}
              onPress={() => leaveTo("/(tabs)/explore")}
              style={({ pressed }) => [styles.headerBtn, pressed && ui.pressed]}
            >
              <Icon name="chevron-back" size={20} color={INK} />
            </Pressable>
            <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>
              {headerTitle}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              onPress={() => leaveTo("/(tabs)/explore")}
              style={({ pressed }) => [styles.headerBtn, pressed && ui.pressed]}
            >
              <Icon name="close" size={20} color={INK} />
            </Pressable>
          </View>

          {(isSuccess || isPending) && <SuccessConfetti />}

          <View style={styles.hero}>
            <Animated.View
              style={[styles.iconWrap, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}
            >
              <GradientFill
                colors={isNegative ? ["#fff1ec", "#fdd9cc"] : isPending ? pastels.gold.gradient : pastels.mint.gradient}
                angle={150}
              />
              <Icon
                name={isNegative ? "close" : isPending ? "hourglass-outline" : "checkmark"}
                size={isPending ? 38 : 46}
                color={isNegative ? "#8a3524" : isPending ? pastels.gold.ink : pastels.mint.ink}
              />
            </Animated.View>

            <View style={styles.statusPill}>
              <StatusPill
                tone={isNegative ? "red" : isPending ? "peach" : "green"}
                label={getBookingStatusLabel(status)}
              />
            </View>

            <Text style={styles.heroTitle}>{copy.title}</Text>
            <Text style={styles.heroDescription}>{copy.description}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
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
                    color={SECONDARY}
                  />
                </View>
              )}
              <View style={styles.providerCopy}>
                <Text style={styles.kind}>{isArtist ? "Solo artist" : "Salon"}</Text>
                <Text style={styles.providerName} numberOfLines={2}>
                  {titleName}
                </Text>
                <Text style={styles.providerArea} numberOfLines={2}>
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
              subvalue={payLabelWithCashback}
              last
            />
            </View>

            {bookingReference ? (
              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Booking ID</Text>
                <View style={styles.refChip}>
                  <Text style={styles.refText}>#{bookingReference}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {(isPending || isSuccess) && (
            <View style={[styles.card, styles.cardGap]}>
              <Text style={ui.sectionLabel}>{copy.panelTitle}</Text>
              {isPending && firstParam(params.payToken) ? (
                <View style={styles.payBlock}>
                  <View style={styles.holdNote}>
                    <Icon name="time-outline" size={16} color="#8a3524" />
                    <Text style={styles.holdText}>
                      Your booking is confirmed once the advance is paid. The time is held for 15 minutes.
                    </Text>
                  </View>
                  <PrimaryPill
                    label="Pay advance"
                    onPress={() => {
                      allowLeave()
                      router.replace({
                        pathname: "/pay/advance/[token]",
                        params: { token: firstParam(params.payToken)!, next: JSON.stringify(params) },
                      } as Href)
                    }}
                  />
                </View>
              ) : null}
              {isPending ? (
                <View style={styles.steps}>
                  {pendingSteps.map((step, index) => (
                    <View key={step} style={styles.stepRow}>
                      <View style={styles.stepIndex}>
                        <Text style={styles.stepIndexText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.tips}>
                  <TipRow pastel={pastels.lavender} icon="notifications-outline">
                    SMS reminders 24h and 2h before your visit.
                  </TipRow>
                  <TipRow pastel={pastels.sky} icon="calendar-outline">
                    Find this appointment anytime under My bookings.
                  </TipRow>
                  {!isArtist ? (
                    <TipRow pastel={pastels.mint} icon="card-outline">
                      Pay at the salon after your service.
                    </TipRow>
                  ) : (
                    <TipRow pastel={pastels.mint} icon="cash-outline">
                      Pay the artist directly for this visit.
                    </TipRow>
                  )}
                </View>
              )}
            </View>
          )}

          {isNegative ? (
            <View style={styles.negativeCard}>
              <Text style={styles.negativeTitle}>Book another time</Text>
              <Text style={styles.negativeText}>
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
            {isNegative ? (
              <>
                <PrimaryPill
                  label="Book again"
                  onPress={() => {
                    allowLeave()
                    if (salonId) {
                      router.replace(
                        isArtist
                          ? { pathname: "/artist/[slug]", params: { slug: salonId } }
                          : { pathname: "/salon/[id]", params: { id: salonId } },
                      )
                      return
                    }
                    leaveTo("/(tabs)/explore")
                  }}
                />
                <OutlineBig label="Go to home" onPress={() => leaveTo("/(tabs)/explore")} />
              </>
            ) : (
              <>
                {/* Flipkart-style: View order first, then continue shopping. */}
                <PrimaryPill
                  label="View my bookings"
                  onPress={() => leaveTo("/(tabs)/bookings")}
                />
                <OutlineBig label="Continue browsing" onPress={() => leaveTo("/(tabs)/explore")} />
              </>
            )}
            <Text style={styles.footerHint}>{copy.footerHint}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

function TipRow({ pastel, icon, children }: { pastel: Pastel; icon: IconName; children: string }) {
  return (
    <View style={styles.tipRow}>
      <PastelIcon pastel={pastel} name={icon} size={32} />
      <Text style={styles.tipText}>{children}</Text>
    </View>
  )
}

/** 52-tall outline pill, the secondary action under the black pill. */
function OutlineBig({
  label,
  onPress,
  icon,
  style,
}: {
  label: string
  onPress: () => void
  icon?: IconName
  style?: object
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.outline, style, pressed && ui.pressed]}
    >
      {icon ? <Icon name={icon} size={16} color={INK} /> : null}
      <Text style={styles.outlineText}>{label}</Text>
    </Pressable>
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
        <OutlineBig
          label="Add to calendar"
          icon="calendar-outline"
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
        <OutlineBig
          label="Directions"
          icon="navigate-outline"
          style={styles.linkBtn}
          onPress={() =>
            openDirections({
              latitude: props.latitude,
              longitude: props.longitude,
              query: location,
            })
          }
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  scroll: { flexGrow: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: INK,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFill,
    top: 60,
    height: 180,
    zIndex: 2,
  },
  confettiDot: {
    position: "absolute",
    top: 8,
    borderRadius: 999,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 12,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#ffffff",
  },
  statusPill: { marginTop: 14 },
  heroTitle: {
    marginTop: 10,
    textAlign: "center",
    fontFamily: fontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    color: INK,
  },
  heroDescription: {
    marginTop: 6,
    textAlign: "center",
    maxWidth: 320,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: SECONDARY,
  },
  body: { paddingHorizontal: 16, paddingTop: 8 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 14,
  },
  cardGap: { marginTop: 16 },
  providerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  providerThumb: { width: 56, height: 56, borderRadius: 14, backgroundColor: "#f3f3f3" },
  providerThumbFallback: { alignItems: "center", justifyContent: "center" },
  providerCopy: { flex: 1, minWidth: 0, gap: 2 },
  kind: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#8a3524",
  },
  providerName: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22, color: INK },
  providerArea: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: SECONDARY },
  passDetails: {
    borderRadius: 14,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#f0f0f0",
    overflow: "hidden",
  },
  passRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  passRowLast: { borderBottomWidth: 0, backgroundColor: "#ffffff" },
  passLabel: {
    width: 72,
    marginTop: 2,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: SECONDARY,
  },
  passValueCol: { flex: 1, minWidth: 0, gap: 2 },
  passValue: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, color: INK },
  passValueTotal: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 21 },
  passSub: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: SECONDARY },
  refRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  refLabel: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: SECONDARY },
  refChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#f2f2f2",
  },
  refText: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18, color: INK, letterSpacing: 0.5 },
  payBlock: { gap: 10 },
  holdNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff1ec",
  },
  holdText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: "#8a3524" },
  steps: { gap: 12 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: INK,
  },
  stepIndexText: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, color: "#ffffff" },
  stepText: { flex: 1, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: INK, marginTop: 3 },
  tips: { gap: 12 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  tipText: { flex: 1, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: INK },
  negativeCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff1ec",
    gap: 4,
  },
  negativeTitle: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: INK },
  negativeText: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: SECONDARY },
  linkRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  linkBtn: { flex: 1 },
  outline: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: INK,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  outlineText: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: INK },
  actions: { marginTop: 24, gap: 12 },
  footerHint: {
    textAlign: "center",
    marginTop: 2,
    paddingHorizontal: 12,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: SECONDARY,
  },
})
