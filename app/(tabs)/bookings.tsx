import { useCallback, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useFocusEffect, useRouter } from "expo-router"
import { formatRupees } from "@/lib/service-pricing"

import { BookingCompactCard, BookingHeroCard } from "@/components/bookings/BookingCards"
import { advanceDueToken, BookingPayStrip } from "@/components/bookings/BookingPayStrip"
import { ActionPill } from "@/components/bookings/BookingPills"
import {
  BookingsEmpty,
  BookingsError,
  BookingsSignedOut,
  BookingsSkeleton,
} from "@/components/bookings/BookingsStates"
import { BookingTimeline } from "@/components/bookings/BookingTimeline"
import { bookingSortMs, groupByMonth, groupUpcoming } from "@/components/bookings/bookingGroups"
import { RefundPreview } from "@/components/bookings/RefundPreview"
import { WaitlistStrip } from "@/components/bookings/WaitlistStrip"
import { GradientFill } from "@/components/home/GradientFill"
import { sp, ui } from "@/components/salon-page/theme"
import { useFloatingTabBarSpace } from "@/components/ui/FloatingTabBar"
import { DownloadInvoiceButton } from "@/components/bookings/DownloadInvoiceButton"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
import { Text } from "@/components/ui/Text"
import type { Booking, BookingStatus } from "@/data/types"
import { ApiError } from "@/lib/api"
import {
  bookingDurationMin,
  canDownloadBookingInvoice,
  FILTER_LABELS,
  formatBookingDate,
  formatBookingWhen,
  formatDuration,
  getBookingStatusLabel,
  isArtistBooking,
  relativeBookingDay,
  statusBadgeColors,
  visitTypeLabel,
} from "@/lib/booking-display"
import { cancelArtistPublicBooking } from "@/lib/artists-api"
import { cancelBooking, fetchBookings, withPaymentStatus } from "@/lib/bookings-api"
import { useCart } from "@/context/CartContext"
import {
  canCustomerCancelBooking,
  CUSTOMER_CANCEL_MIN_NOTICE_HOURS,
  getCancelBlockedReason,
} from "@/lib/cancel-policy"
import {
  canRescheduleWithNotice,
  getRescheduleBlockedReason,
} from "@/lib/reschedule-policy"
import { openDirections } from "@/lib/visit-links"
import { getAccessToken } from "@/lib/session"
import { colors, fontFamily, radii, spacing } from "@/theme/tokens"

type Filter = keyof typeof FILTER_LABELS

const upcomingStatuses: BookingStatus[] = ["pending", "confirmed", "upcoming"]
const cancelledStatuses: BookingStatus[] = ["cancelled", "declined", "expired", "payment_failed"]

const CANCEL_REASON_IDS = [
  "change_of_plans",
  "found_another",
  "different_time",
  "other",
] as const

type CancelReasonId = (typeof CANCEL_REASON_IDS)[number]

function cancelReasonsFor(kind: "salon" | "artist") {
  return [
    { id: "change_of_plans" as const, label: "Change of plans" },
    {
      id: "found_another" as const,
      label: kind === "artist" ? "Found another artist" : "Found another salon",
    },
    { id: "different_time" as const, label: "Timing no longer works" },
    { id: "other" as const, label: "Other" },
  ]
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const tone = statusBadgeColors(status)
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tone.bg, borderColor: tone.border },
      ]}
    >
      <View style={[styles.badgeDot, { backgroundColor: tone.dot }]} />
      <Text variant="caption" color={tone.text} numberOfLines={1}>
        {getBookingStatusLabel(status)}
      </Text>
    </View>
  )
}

function KindPill({ artist }: { artist: boolean }) {
  return (
    <View style={[styles.kindPill, artist && styles.kindPillArtist]}>
      <Icon
        name={artist ? "sparkles-outline" : "storefront-outline"}
        size={12}
        color={artist ? colors.primary : colors.textMuted}
      />
      <Text variant="caption" color={artist ? colors.primary : colors.textMuted}>
        {artist ? "Solo artist" : "Salon"}
      </Text>
    </View>
  )
}

function DetailRow({
  icon,
  label,
  value,
  subvalue,
}: {
  icon: string
  label: string
  value: string
  subvalue?: string | null
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Icon name={icon} size={16} color={colors.textMuted} />
      </View>
      <View style={styles.detailCopy}>
        <Text variant="label" muted style={styles.detailLabel}>
          {label}
        </Text>
        <Text variant="bodyStrong" numberOfLines={2}>
          {value}
        </Text>
        {subvalue ? (
          <Text variant="caption" muted numberOfLines={2}>
            {subvalue}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

/** Tax or charges the salon billed on top of the listed services. */
function salonExtras(booking: Booking): string {
  const services = booking.services.reduce((sum, item) => sum + item.price, 0)
  const extra = Math.round((booking.price - services) * 100) / 100
  return services > 0 && extra > 0 ? ` · includes ${formatRupees(extra)} tax and charges` : ""
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={[ui.sectionLabel, page.sectionLabel]}>{children}</Text>
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets()
  const tabBarSpace = useFloatingTabBarSpace()
  const cart = useCart()
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<Booking | null>(null)

  /** A held slot just ran out on screen: it shows as Payment failed without a reload. */
  const applyPaymentTimeouts = useCallback(() => {
    setBookings((current) => current.map((booking) => withPaymentStatus(booking)))
    setSelected((current) => (current ? withPaymentStatus(current) : current))
  }, [])
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState<CancelReasonId>("change_of_plans")
  const [cancelNote, setCancelNote] = useState("")
  const [cancelling, setCancelling] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function reloadBookings() {
    setLoading(true)
    setLoadError(null)
    try {
      const next = await fetchBookings()
      setBookings(next)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthed(false)
        setBookings([])
        setLoadError(null)
        return
      }
      setBookings([])
      const message =
        error instanceof ApiError
          ? error.message
          : "Could not load bookings. Check your connection and try again."
      setLoadError(message)
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      ;(async () => {
        const token = await getAccessToken()
        if (cancelled) return
        setAuthed(Boolean(token))
        setAuthChecked(true)
        if (!token) {
          setLoading(false)
          setBookings([])
          setLoadError(null)
          return
        }
        setLoading(true)
        setLoadError(null)
        try {
          const next = await fetchBookings()
          if (cancelled) return
          setBookings(next)
        } catch (error) {
          if (cancelled) return
          if (error instanceof ApiError && error.status === 401) {
            setAuthed(false)
            setBookings([])
            setLoadError(null)
            return
          }
          setBookings([])
          const message =
            error instanceof ApiError
              ? error.message
              : "Could not load bookings. Check your connection and try again."
          setLoadError(message)
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }, []),
  )

  const counts = useMemo(() => {
    return {
      all: bookings.length,
      upcoming: bookings.filter((b) => upcomingStatuses.includes(b.status)).length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => cancelledStatuses.includes(b.status)).length,
    }
  }, [bookings])

  const list = useMemo(() => {
    return bookings.filter((booking) => {
      if (filter === "all") return true
      if (filter === "upcoming") return upcomingStatuses.includes(booking.status)
      if (filter === "cancelled") return cancelledStatuses.includes(booking.status)
      return booking.status === filter
    })
  }, [bookings, filter])

  /** Upcoming soonest first (the first one is the hero); everything else newest first, by month. */
  const sections = useMemo(() => {
    const upcoming = list
      .filter((b) => upcomingStatuses.includes(b.status))
      .sort((a, b) => bookingSortMs(a) - bookingSortMs(b))
    const past = list
      .filter((b) => !upcomingStatuses.includes(b.status))
      .sort((a, b) => bookingSortMs(b) - bookingSortMs(a))
    return {
      hero: upcoming[0] ?? null,
      upcomingGroups: groupUpcoming(upcoming.slice(1)),
      pastGroups: groupByMonth(past),
    }
  }, [list])

  const subtitle = useMemo(() => {
    if (!authChecked || (authed && loading && bookings.length === 0)) return "Loading your appointments…"
    if (!authed) return "Sign in to see salon and solo-artist visits."
    if (counts.upcoming > 0) return `${counts.upcoming} upcoming · ${counts.all} total`
    if (counts.all > 0) return `No upcoming visits · ${counts.all} total`
    return "No upcoming visits"
  }, [authChecked, authed, loading, bookings.length, counts.upcoming, counts.all])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  /** Same services (and stylist) as this booking, straight to picking a time. */
  function bookAgain(booking: Booking) {
    setSelected(null)
    if (isArtistBooking(booking)) {
      const slug = booking.artistSlug || booking.salonId
      router.push({
        pathname: "/artist/book/[slug]",
        params: booking.artistServiceId ? { slug, serviceIds: booking.artistServiceId } : { slug },
      })
      return
    }
    const serviceIds = booking.services.map((s) => s.id).filter((id) => id && id !== "service")
    if (serviceIds.length === 0) {
      router.push({ pathname: "/salon/[id]", params: { id: booking.salonId } })
      return
    }
    cart.clearSalon(booking.salonId)
    for (const id of serviceIds) cart.toggleService(booking.salonId, id)
    router.push({
      pathname: "/book/[salonId]",
      params: booking.staffId ? { salonId: booking.salonId, staffId: booking.staffId } : { salonId: booking.salonId },
    })
  }

  /** Same rules as the details sheet's Book again button. */
  function canBookAgain(booking: Booking) {
    if (!isArtistBooking(booking)) return true
    return Boolean(booking.artistSlug || booking.salonId) &&
      (upcomingStatuses.includes(booking.status) || booking.status === "completed")
  }

  function artistToken(booking: Booking) {
    return booking.artistPublicToken?.trim() || booking.id.replace(/^artist:/, "").trim()
  }

  /** Same rules as the details sheet's Leave a review button. */
  function canReview(booking: Booking) {
    if (booking.status !== "completed" || booking.hasVerifiedReview) return false
    return isArtistBooking(booking) ? Boolean(artistToken(booking)) : true
  }

  function openReview(booking: Booking) {
    setSelected(null)
    if (isArtistBooking(booking)) {
      router.push({
        pathname: "/review",
        params: { kind: "artist", artistPublicToken: artistToken(booking), salonName: booking.salonName },
      })
      return
    }
    const staffName = booking.staffName?.trim() || ""
    router.push({
      pathname: "/review",
      params: { appointmentId: booking.id, salonName: booking.salonName, ...(staffName ? { staffName } : {}) },
    })
  }

  function heroActions(booking: Booking) {
    const artist = isArtistBooking(booking)
    const canReschedule = !artist && canRescheduleWithNotice(booking.startsAt).allowed
    // Same rule as Home's next-booking card: salon visits with nothing left to pay.
    const canDirect = !artist && !advanceDueToken(booking)
    return (
      <>
        <ActionPill label="View details" onPress={() => setSelected(booking)} />
        {canDirect ? (
          <ActionPill
            label="Directions"
            icon="navigate-outline"
            outline
            onPress={() =>
              openDirections({ query: [booking.salonName, booking.salonArea].filter(Boolean).join(", ") })
            }
          />
        ) : null}
        {canReschedule ? (
          <ActionPill
            label="Reschedule"
            outline
            onPress={() => router.push({ pathname: "/bookings/[id]/reschedule", params: { id: booking.id } })}
          />
        ) : null}
      </>
    )
  }

  function pastActions(booking: Booking) {
    if (upcomingStatuses.includes(booking.status)) return undefined
    const review = canReview(booking)
    const again = canBookAgain(booking)
    if (!review && !again) return undefined
    return (
      <>
        {review ? <ActionPill small label="Rate" icon="star-outline" onPress={() => openReview(booking)} /> : null}
        {again ? <ActionPill small outline label="Book again" onPress={() => bookAgain(booking)} /> : null}
      </>
    )
  }

  function renderCompact(booking: Booking) {
    return (
      <BookingCompactCard
        key={booking.id}
        booking={booking}
        onPress={() => setSelected(booking)}
        onPaymentExpired={applyPaymentTimeouts}
        actions={pastActions(booking)}
      />
    )
  }

  const header = (
    <View style={[page.header, { paddingTop: insets.top + 12 }]}>
      <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />
      <Text style={page.title} accessibilityRole="header">
        My bookings
      </Text>
      <Text style={page.subtitle} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  )

  if (!authChecked || !authed) {
    return (
      <ScrollView
        style={page.page}
        contentContainerStyle={{ paddingBottom: tabBarSpace + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {header}
        <View style={page.body}>
          {!authChecked || loading ? (
            <BookingsSkeleton />
          ) : (
            <BookingsSignedOut
              onSignIn={() =>
                router.push({ pathname: "/login", params: { next: "/(tabs)/bookings" } })
              }
            />
          )}
        </View>
      </ScrollView>
    )
  }

  const selectedArtist = selected ? isArtistBooking(selected) : false
  const selectedVisit = selected ? visitTypeLabel(selected) : null
  const visitDone = selected?.status === "completed"
  const providerSlug = selected ? selected.artistSlug || selected.salonId : ""
  // After a visit, Review / Book again lead and the profile link drops to the bottom.
  const viewProviderButton =
    selected && providerSlug ? (
      <Button
        label={selectedArtist ? "View artist" : "View salon"}
        variant={visitDone ? "secondary" : "primary"}
        onPress={() => {
          setSelected(null)
          if (selectedArtist) {
            router.push({ pathname: "/artist/[slug]", params: { slug: providerSlug } })
          } else {
            router.push({ pathname: "/salon/[id]", params: { id: providerSlug } })
          }
        }}
      />
    ) : null
  const selectedRelative = selected ? relativeBookingDay(selected.date) : null
  const { hero, upcomingGroups, pastGroups } = sections

  return (
    <View style={page.page}>
      <ScrollView
        style={page.page}
        contentContainerStyle={{ paddingBottom: tabBarSpace + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {header}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={page.chips}
          style={page.chipsScroll}
        >
          {(Object.keys(FILTER_LABELS) as Filter[]).map((item) => {
            const active = filter === item
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${FILTER_LABELS[item]}, ${counts[item]}`}
                key={item}
                style={({ pressed }) => [ui.chip, page.chip, active && ui.chipActive, pressed && ui.pressed]}
                onPress={() => setFilter(item)}
              >
                <Text style={[ui.chipText, active && ui.chipTextActive]}>{FILTER_LABELS[item]}</Text>
                <Text style={[page.chipCount, active && page.chipCountActive]}>{counts[item]}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={page.body}>
          {toast ? (
            <View style={page.toast}>
              <Text style={page.toastText}>{toast}</Text>
            </View>
          ) : null}
          <WaitlistStrip />

          {loading ? (
            <View style={page.top}>
              <BookingsSkeleton />
            </View>
          ) : loadError ? (
            <BookingsError message={loadError} onRetry={() => void reloadBookings()} />
          ) : list.length === 0 ? (
            <BookingsEmpty filter={filter} onFind={() => router.push("/(tabs)")} />
          ) : (
            <>
              {hero ? (
                <View style={page.top}>
                  <SectionLabel>Next visit</SectionLabel>
                  <BookingHeroCard
                    booking={hero}
                    onPress={() => setSelected(hero)}
                    onPaymentExpired={applyPaymentTimeouts}
                    actions={heroActions(hero)}
                  />
                </View>
              ) : null}
              {upcomingGroups.map((group) => (
                <View key={`u-${group.label}`} style={page.group}>
                  <SectionLabel>{group.label}</SectionLabel>
                  {group.items.map(renderCompact)}
                </View>
              ))}
              {pastGroups.map((group) => (
                <View key={`p-${group.label}`} style={page.group}>
                  <SectionLabel>{group.label}</SectionLabel>
                  {group.items.map(renderCompact)}
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      <BottomSheet
        visible={Boolean(selected)}
        title={cancelOpen ? "Cancel booking" : "Appointment details"}
        contentKey={cancelOpen ? "cancel" : "details"}
        onClose={() => {
          // One sheet, two modes — avoid nested Modals (cancel never opened on device).
          if (cancelOpen) {
            setCancelOpen(false)
            return
          }
          setSelected(null)
        }}
      >
        {selected && cancelOpen ? (
          <View style={styles.sheetBody}>
            <Text muted>
              {selected.status === "pending"
                ? "This booking is still waiting for confirmation. You can cancel the request anytime."
                : (selected.cancelNoticeHours ?? CUSTOMER_CANCEL_MIN_NOTICE_HOURS) <= 0
                  ? "You can cancel until the appointment starts. Tell us why you are cancelling."
                  : `Free cancellation until ${selected.cancelNoticeHours ?? CUSTOMER_CANCEL_MIN_NOTICE_HOURS} hours before your appointment. Tell us why you are cancelling.`}
            </Text>
            {selected.cancelRefund ? (
              <RefundPreview booking={selected} />
            ) : selected.cancelRefundNote ? (
              <Text style={styles.refundNote}>{selected.cancelRefundNote}</Text>
            ) : null}
            <Text variant="caption" muted>
              {formatBookingWhen(selected)} · {selected.salonName}
            </Text>
            {cancelReasonsFor(isArtistBooking(selected) ? "artist" : "salon").map((reason) => (
              <Pressable
                accessibilityRole="button"
                key={reason.id}
                style={[styles.reasonRow, cancelReason === reason.id && styles.chipActive]}
                onPress={() => setCancelReason(reason.id)}
              >
                <Text color={cancelReason === reason.id ? colors.primary : colors.text}>
                  {reason.label}
                </Text>
              </Pressable>
            ))}
            <Input
              label="Extra note"
              value={cancelNote}
              onChangeText={setCancelNote}
              placeholder={cancelReason === "other" ? "Required for Other" : "Optional"}
            />
            <Button
              label="Confirm cancel"
              loading={cancelling}
              onPress={() => {
                void (async () => {
                  if (cancelReason === "other" && !cancelNote.trim()) {
                    showToast("Please add a note for Other")
                    return
                  }
                  setCancelling(true)
                  try {
                    if (isArtistBooking(selected)) {
                      const token =
                        selected.artistPublicToken?.trim() ||
                        selected.id.replace(/^artist:/, "").trim()
                      if (!token) throw new Error("Cancel unavailable for this booking.")
                      const reasons = cancelReasonsFor("artist")
                      const reasonLabel =
                        reasons.find((item) => item.id === cancelReason)?.label ?? cancelReason
                      const details = cancelNote.trim()
                      await cancelArtistPublicBooking({
                        publicToken: token,
                        reason: details ? `${reasonLabel}: ${details}` : reasonLabel,
                      })
                    } else {
                      await cancelBooking(selected.id, {
                        reasonId: cancelReason,
                        details: cancelNote.trim() || undefined,
                      })
                    }
                    setCancelOpen(false)
                    setSelected(null)
                    setCancelNote("")
                    showToast("Booking cancelled")
                    await reloadBookings()
                  } catch (err) {
                    showToast(
                      err instanceof ApiError || err instanceof Error
                        ? err.message
                        : "Cancel failed",
                    )
                  } finally {
                    setCancelling(false)
                  }
                })()
              }}
            />
            <Button
              label="Keep booking"
              variant="secondary"
              disabled={cancelling}
              onPress={() => setCancelOpen(false)}
            />
          </View>
        ) : selected ? (
          <View style={styles.sheetBody}>
            <View style={styles.sheetHero}>
              <View style={styles.sheetHeroTop}>
                <KindPill artist={selectedArtist} />
                <StatusBadge status={selected.status} />
              </View>
              <Text variant="heading" style={styles.sheetTitle}>
                {selected.salonName}
              </Text>
              <View style={styles.areaRow}>
                <Icon name="location-outline" size={14} color={colors.textMuted} />
                <Text variant="caption" muted numberOfLines={2} style={{ flex: 1 }}>
                  {selected.salonArea || "—"}
                  {selectedVisit ? ` · ${selectedVisit}` : ""}
                </Text>
              </View>
              {!selectedArtist && selected.id ? (
                <Text variant="caption" muted>
                  Booking #{selected.id.slice(0, 8).toUpperCase()}
                </Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text variant="label" muted style={styles.sectionLabel}>
                Progress
              </Text>
              <View style={[styles.sectionCard, styles.timelineCard]}>
                <BookingTimeline booking={selected} />
              </View>
            </View>

            <View style={styles.section}>
              <Text variant="label" muted style={styles.sectionLabel}>
                When
              </Text>
              <View style={styles.sectionCard}>
                <DetailRow
                  icon="calendar-outline"
                  label="Date"
                  value={
                    selectedRelative
                      ? `${selectedRelative} · ${formatBookingDate(selected.date)}`
                      : formatBookingDate(selected.date)
                  }
                />
                <View style={styles.sectionDivider} />
                <DetailRow
                  icon="time-outline"
                  label="Time"
                  value={selected.time?.trim() || "—"}
                  subvalue={
                    bookingDurationMin(selected) > 0
                      ? `About ${formatDuration(bookingDurationMin(selected))}`
                      : null
                  }
                />
                <View style={styles.sectionDivider} />
                <DetailRow
                  icon="person-outline"
                  label={selectedArtist ? "With" : "Stylist"}
                  value={
                    selectedArtist
                      ? selected.salonName
                      : selected.staffName?.trim() || "Any available"
                  }
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text variant="label" muted style={styles.sectionLabel}>
                Services
              </Text>
              <View style={styles.sectionCard}>
                {selected.services.length === 0 ? (
                  <Text variant="caption" muted style={styles.sectionPad}>
                    No services listed
                  </Text>
                ) : (
                  selected.services.map((service, index) => (
                    <View key={service.id}>
                      {index > 0 ? <View style={styles.sectionDivider} /> : null}
                      <View style={styles.serviceRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text variant="bodyStrong" numberOfLines={2}>
                            {service.name}
                          </Text>
                          <Text variant="caption" muted>
                            {formatDuration(service.durationMin)}
                          </Text>
                        </View>
                        <Text variant="bodyStrong">{formatRupees(service.price)}</Text>
                      </View>
                    </View>
                  ))
                )}
                {selected.travelFee ? (
                  <>
                    <View style={styles.sectionDivider} />
                    <View style={styles.serviceRow}>
                      <Text variant="bodyStrong" style={{ flex: 1 }}>
                        Travel fee
                      </Text>
                      <Text variant="bodyStrong">{formatRupees(selected.travelFee)}</Text>
                    </View>
                  </>
                ) : null}
              </View>
            </View>

            {selected.declineReason?.trim() ? (
              <View style={styles.alertBox}>
                <Text variant="caption" color={colors.destructive}>
                  {selected.declineReason}
                </Text>
              </View>
            ) : null}

            {!selectedArtist && selected.notes?.trim() ? (
              <View style={styles.noteBox}>
                <Text variant="label" muted style={styles.sectionLabel}>
                  Note
                </Text>
                <Text variant="caption">{selected.notes.trim()}</Text>
              </View>
            ) : null}

            {selected.hasVerifiedReview && selected.review ? (
              <View style={styles.section}>
                <Text variant="label" muted style={styles.sectionLabel}>
                  Your review
                </Text>
                <View style={styles.reviewCard}>
                  <View style={styles.reviewHead}>
                    <View style={styles.ratingPill}>
                      <Text variant="caption" color={colors.primaryFg}>
                        ★ {selected.review.rating.toFixed(1)}
                      </Text>
                    </View>
                    <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
                      {selected.review.reviewType || "Overall experience"}
                    </Text>
                  </View>
                  {selected.review.comment ? (
                    <Text variant="body" muted style={{ marginTop: spacing.sm }}>
                      {selected.review.comment}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={styles.payCard}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="label" muted style={styles.sectionLabel}>
                  Total
                </Text>
                <Text variant="caption" muted>
                  {selectedArtist
                    ? selected.advanceAmount && selected.advancePaid
                      ? `${formatRupees(selected.advanceAmount)} advance paid · ${formatRupees(Math.max(0, selected.price - selected.advanceAmount))} at the visit`
                      : selected.advanceAmount && advanceDueToken(selected)
                        ? `${formatRupees(selected.advanceAmount)} advance due now · rest at the visit`
                        : "Pay artist directly"
                    : selected.advanceAmount && selected.advancePaid
                      ? `${formatRupees(selected.advanceAmount)} advance paid · rest at the salon`
                      : selected.advanceAmount && advanceDueToken(selected)
                        ? `${formatRupees(selected.advanceAmount)} advance due now · rest at the salon`
                        : `${selected.status === "completed" ? "Paid at salon" : "Pay at salon"}${salonExtras(selected)}`}
                </Text>
              </View>
              <Text variant="title" style={styles.payAmount}>
                {formatRupees(selected.price)}
              </Text>
            </View>

            <BookingPayStrip booking={selected} onExpired={applyPaymentTimeouts} />

            {!selectedArtist && canDownloadBookingInvoice(selected) ? (
              <DownloadInvoiceButton
                bookingId={selected.crmAppointmentId ?? selected.id}
              />
            ) : null}

            <View style={styles.actions}>
              {selectedArtist ? (
                <>
                  {visitDone ? null : viewProviderButton}
                  {selected.status === "completed" &&
                  !selected.hasVerifiedReview &&
                  (selected.artistPublicToken ||
                    selected.id.replace(/^artist:/, "").trim()) ? (
                    <Button
                      label="Leave a review"
                      onPress={() => {
                        const token =
                          selected.artistPublicToken?.trim() ||
                          selected.id.replace(/^artist:/, "").trim()
                        const artistName = selected.salonName
                        setSelected(null)
                        router.push({
                          pathname: "/review",
                          params: {
                            kind: "artist",
                            artistPublicToken: token,
                            salonName: artistName,
                          },
                        })
                      }}
                    />
                  ) : null}
                  {(selected.artistSlug || selected.salonId) &&
                  (upcomingStatuses.includes(selected.status) ||
                    selected.status === "completed") ? (
                    <Button
                      label="Book again"
                      variant={visitDone && selected.hasVerifiedReview ? "primary" : "secondary"}
                      onPress={() => bookAgain(selected)}
                    />
                  ) : null}
                  {upcomingStatuses.includes(selected.status) ? (
                    canCustomerCancelBooking(selected).allowed ? (
                      <Button
                        label="Cancel booking"
                        variant="ghost"
                        onPress={() => {
                          setCancelReason("change_of_plans")
                          setCancelNote("")
                          setCancelOpen(true)
                        }}
                      />
                    ) : (
                      <Text variant="caption" muted style={styles.policyHint}>
                        {getCancelBlockedReason(
                          selected.startsAt,
                          selected.cancelNoticeHours ?? CUSTOMER_CANCEL_MIN_NOTICE_HOURS,
                          "artist",
                        )}
                      </Text>
                    )
                  ) : null}
                  {visitDone ? viewProviderButton : null}
                </>
              ) : (
                <>
                  {visitDone ? null : viewProviderButton}
                  {upcomingStatuses.includes(selected.status) ? (
                    <>
                      {canRescheduleWithNotice(selected.startsAt).allowed ? (
                        <Button
                          label="Reschedule"
                          variant="secondary"
                          onPress={() => {
                            const id = selected.id
                            setSelected(null)
                            router.push({
                              pathname: "/bookings/[id]/reschedule",
                              params: { id },
                            })
                          }}
                        />
                      ) : (
                        <Text variant="caption" muted style={styles.policyHint}>
                          {getRescheduleBlockedReason(selected.startsAt)}
                        </Text>
                      )}
                      {canCustomerCancelBooking(selected).allowed ? (
                        <Button
                          label="Cancel booking"
                          variant="ghost"
                          onPress={() => {
                            setCancelReason("change_of_plans")
                            setCancelNote("")
                            setCancelOpen(true)
                          }}
                        />
                      ) : (
                        <Text variant="caption" muted style={styles.policyHint}>
                          {getCancelBlockedReason(
                            selected.startsAt,
                            selected.cancelNoticeHours ?? CUSTOMER_CANCEL_MIN_NOTICE_HOURS,
                          )}
                        </Text>
                      )}
                    </>
                  ) : null}
                  {selected.status === "completed" && !selected.hasVerifiedReview ? (
                    <Button
                      label="Leave a review"
                      onPress={() => {
                        const appointmentId = selected.id
                        const salonName = selected.salonName
                        const staffName = selected.staffName?.trim() || ""
                        setSelected(null)
                        router.push({
                          pathname: "/review",
                          params: {
                            appointmentId,
                            salonName,
                            ...(staffName ? { staffName } : {}),
                          },
                        })
                      }}
                    />
                  ) : null}
                  <Button
                    label="Book again"
                    variant={visitDone && selected.hasVerifiedReview ? "primary" : "secondary"}
                    onPress={() => bookAgain(selected)}
                  />
                  {visitDone ? viewProviderButton : null}
                </>
              )}
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  )
}

const page = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  title: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 30, color: sp.text },
  subtitle: { marginTop: 4, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 19, color: sp.secondary },
  chipsScroll: { flexGrow: 0 },
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  chip: { height: 36 },
  chipCount: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, color: sp.secondary },
  chipCountActive: { color: "rgba(255,255,255,0.75)" },
  body: { paddingHorizontal: 16 },
  top: { marginTop: 20, gap: 10 },
  group: { marginTop: 24, gap: 10 },
  sectionLabel: { paddingHorizontal: 4 },
  toast: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: sp.grey },
  toastText: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: sp.text },
})

const styles = StyleSheet.create({
  refundNote: {
    backgroundColor: "#FFF7E6",
    color: "#7A4B00",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  screen: {
    flex: 1,
  },
  gap: {
    marginTop: spacing.sm,
  },
  toast: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "#F1F1F1",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  filtersWrap: {
    marginTop: spacing.xl,
    marginHorizontal: -spacing.xl,
    flexGrow: 0,
    flexShrink: 0,
  },
  filtersScroll: {
    flexGrow: 0,
  },
  filters: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    flexWrap: "nowrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexShrink: 0,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: "#F1F1F1",
  },
  chipLabelActive: {
    fontFamily: "Geist_600SemiBold",
  },
  countPill: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
  },
  countPillActive: {
    backgroundColor: "#F1F1F1",
  },
  countText: {
    fontSize: 11,
    textAlign: "center",
  },
  listScroll: {
    flex: 1,
    marginTop: spacing.lg,
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.94,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  cardBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  cardTitleBlock: {
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 17,
  },
  areaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  whenBlock: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  whenMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  relative: {
    fontFamily: "Geist_600SemiBold",
  },
  staffChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "42%",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
  },
  kindPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
  },
  kindPillArtist: {
    backgroundColor: "#F1F1F1",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardReview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  ratingPill: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  reviewCard: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  reviewHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sheetBody: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetHero: {
    gap: spacing.sm,
  },
  sheetHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sheetTitle: {
    fontSize: 20,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    letterSpacing: 1,
  },
  sectionCard: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  sectionPad: {
    padding: spacing.lg,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.lg + 36,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  detailLabel: {
    fontSize: 10,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  alertBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "#FEF2F2",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FCA5A5",
  },
  noteBox: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  timelineCard: {
    padding: spacing.lg,
  },
  payStrip: {
    marginTop: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "#FFF4D6",
  },
  payCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: "#F1F1F1",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D4D4D4",
  },
  payAmount: {
    fontSize: 24,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  policyHint: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  reasonRow: {
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
})
