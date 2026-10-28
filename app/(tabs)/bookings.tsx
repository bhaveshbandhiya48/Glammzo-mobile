import { useCallback, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { BookingsEmptyState } from "@/components/bookings/BookingsEmptyState"
import { DownloadInvoiceButton } from "@/components/bookings/DownloadInvoiceButton"
import { ShareArtistInvoiceButton } from "@/components/bookings/ShareArtistInvoiceButton"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
import { Screen } from "@/components/ui/Screen"
import { BookingsListSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import type { Booking, BookingStatus } from "@/data/types"
import { ApiError } from "@/lib/api"
import {
  bookingDurationMin,
  canDownloadBookingInvoice,
  FILTER_LABELS,
  formatBookingDate,
  formatBookingDateShort,
  formatBookingWhen,
  formatDuration,
  getBookingStatusLabel,
  isArtistBooking,
  relativeBookingDay,
  serviceSummary,
  statusBadgeColors,
  visitTypeLabel,
} from "@/lib/booking-display"
import { cancelArtistPublicBooking } from "@/lib/artists-api"
import { cancelBooking, fetchBookings } from "@/lib/bookings-api"
import {
  canCancelWithNotice,
  CUSTOMER_CANCEL_MIN_NOTICE_HOURS,
  getCancelBlockedReason,
} from "@/lib/cancel-policy"
import {
  canRescheduleWithNotice,
  getRescheduleBlockedReason,
} from "@/lib/reschedule-policy"
import { getAccessToken } from "@/lib/session"
import { colors, radii, spacing } from "@/theme/tokens"

type Filter = keyof typeof FILTER_LABELS

const upcomingStatuses: BookingStatus[] = ["pending", "confirmed", "upcoming"]
const cancelledStatuses: BookingStatus[] = ["cancelled", "declined", "expired"]

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
        color={artist ? colors.coral : colors.textMuted}
      />
      <Text variant="caption" color={artist ? colors.coral : colors.textMuted}>
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

function BookingCard({
  booking,
  onPress,
}: {
  booking: Booking
  onPress: () => void
}) {
  const artist = isArtistBooking(booking)
  const duration = bookingDurationMin(booking)
  const relative = relativeBookingDay(booking.date)
  const visit = visitTypeLabel(booking)
  const services = booking.services.map((s) => s.name).filter(Boolean)
  const serviceLine =
    services.length === 0
      ? serviceSummary(booking)
      : services.length <= 2
        ? services.join(" · ")
        : `${services.slice(0, 2).join(" · ")} +${services.length - 2}`

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <StatusBadge status={booking.status} />
        <KindPill artist={artist} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTitleBlock}>
          <Text variant="heading" numberOfLines={2} style={styles.cardTitle}>
            {booking.salonName}
          </Text>
          <View style={styles.areaRow}>
            <Icon name="location-outline" size={14} color={colors.textMuted} />
            <Text variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
              {[booking.salonArea, visit].filter(Boolean).join(" · ") || "—"}
            </Text>
          </View>
        </View>

        <View style={styles.whenBlock}>
          <View style={styles.whenMain}>
            {relative ? (
              <Text variant="caption" color={colors.coral} style={styles.relative}>
                {relative}
              </Text>
            ) : null}
            <Text variant="bodyStrong">{formatBookingDateShort(booking.date)}</Text>
            <Text variant="caption" muted>
              {booking.time?.trim() || "—"}
              {duration > 0 ? ` · ~${formatDuration(duration)}` : ""}
            </Text>
          </View>
          {!artist && booking.staffName?.trim() ? (
            <View style={styles.staffChip}>
              <Icon name="person-outline" size={13} color={colors.textMuted} />
              <Text variant="caption" muted numberOfLines={1}>
                {booking.staffName.trim()}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text variant="caption" muted style={{ flex: 1 }} numberOfLines={2}>
          {serviceLine}
        </Text>
        <View style={styles.priceRow}>
          <Text variant="heading">₹{Math.round(booking.price)}</Text>
          <Icon name="chevron-forward" size={16} color={colors.textSubtle} />
        </View>
      </View>

      {booking.hasVerifiedReview && booking.review ? (
        <View style={styles.cardReview}>
          <View style={styles.ratingPill}>
            <Text variant="caption" color={colors.primaryFg}>
              ★ {booking.review.rating.toFixed(1)}
            </Text>
          </View>
          <Text variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
            Your review
            {booking.review.reviewType ? ` · ${booking.review.reviewType}` : ""}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

export default function BookingsScreen() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<Booking | null>(null)
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

  const subtitle = useMemo(() => {
    if (!authed) return "Sign in to see salon and solo-artist visits."
    if (loading && bookings.length === 0) return "Loading your appointments…"
    if (counts.upcoming > 0) {
      return `${counts.upcoming} upcoming · ${counts.all} total`
    }
    if (counts.all > 0) return `${counts.all} booking${counts.all === 1 ? "" : "s"}`
    return "Your salon and solo-artist appointments."
  }, [authed, loading, bookings.length, counts.upcoming, counts.all])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  if (!authChecked || (!authed && loading)) {
    return (
      <Screen edges={["top", "left", "right"]} contentStyle={styles.screen}>
        <Text variant="title">My bookings</Text>
        <Text muted style={styles.gap}>
          Loading your appointments…
        </Text>
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          <BookingsListSkeleton count={3} />
        </ScrollView>
      </Screen>
    )
  }

  if (!authed) {
    return (
      <Screen edges={["top", "left", "right"]} contentStyle={styles.screen}>
        <Text variant="title">My bookings</Text>
        <Text muted style={styles.gap}>
          Sign in to see salon and solo-artist visits.
        </Text>
        <BookingsEmptyState
          signedOut
          onSignIn={() =>
            router.push({ pathname: "/login", params: { next: "/(tabs)/bookings" } })
          }
        />
      </Screen>
    )
  }

  const selectedArtist = selected ? isArtistBooking(selected) : false
  const selectedVisit = selected ? visitTypeLabel(selected) : null
  const selectedRelative = selected ? relativeBookingDay(selected.date) : null

  return (
    <Screen edges={["top", "left", "right"]} contentStyle={styles.screen}>
      <Text variant="title">My bookings</Text>
      <Text muted style={styles.gap}>
        {subtitle}
      </Text>
      {toast ? (
        <View style={styles.toast}>
          <Text variant="caption">{toast}</Text>
        </View>
      ) : null}

      <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          style={styles.filtersScroll}
        >
          {(Object.keys(FILTER_LABELS) as Filter[]).map((item) => {
            const active = filter === item
            return (
              <Pressable
                key={item}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(item)}
              >
                <Text
                  variant="caption"
                  color={active ? colors.coral : colors.text}
                  style={active ? styles.chipLabelActive : undefined}
                >
                  {FILTER_LABELS[item]}
                </Text>
                <View style={[styles.countPill, active && styles.countPillActive]}>
                  <Text
                    variant="caption"
                    color={active ? colors.coral : colors.textMuted}
                    style={styles.countText}
                  >
                    {counts[item]}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          <BookingsListSkeleton count={3} />
        </ScrollView>
      ) : loadError ? (
        <View style={styles.errorState}>
          <Text variant="bodyStrong">Couldn&apos;t load bookings</Text>
          <Text muted style={{ textAlign: "center" }}>
            {loadError}
          </Text>
          <Button label="Try again" onPress={() => void reloadBookings()} />
        </View>
      ) : list.length === 0 ? (
        <BookingsEmptyState filter={filter} />
      ) : (
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {list.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onPress={() => setSelected(booking)}
            />
          ))}
        </ScrollView>
      )}

      <BottomSheet
        visible={Boolean(selected) && !cancelOpen}
        title="Appointment details"
        onClose={() => setSelected(null)}
      >
        {selected ? (
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
                        <Text variant="bodyStrong">₹{Math.round(service.price)}</Text>
                      </View>
                    </View>
                  ))
                )}
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
                    ? "Pay artist directly"
                    : selected.status === "completed"
                      ? "Paid at salon"
                      : "Pay at salon"}
                </Text>
              </View>
              <Text variant="title" style={styles.payAmount}>
                ₹{Math.round(selected.price)}
              </Text>
            </View>

            {selectedArtist ? (
              <ShareArtistInvoiceButton booking={selected} />
            ) : canDownloadBookingInvoice(selected) ? (
              <DownloadInvoiceButton
                bookingId={selected.crmAppointmentId ?? selected.id}
              />
            ) : null}

            <View style={styles.actions}>
              {selectedArtist ? (
                <>
                  {selected.artistSlug || selected.salonId ? (
                    <Button
                      label="View artist"
                      onPress={() => {
                        const slug = selected.artistSlug || selected.salonId
                        setSelected(null)
                        router.push({
                          pathname: "/artist/[slug]",
                          params: { slug },
                        })
                      }}
                    />
                  ) : null}
                  {selected.status === "completed" &&
                  !selected.hasVerifiedReview &&
                  (selected.artistPublicToken ||
                    selected.id.replace(/^artist:/, "").trim()) ? (
                    <Button
                      label="Leave a review"
                      variant="secondary"
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
                      variant="secondary"
                      onPress={() => {
                        const slug = selected.artistSlug || selected.salonId
                        setSelected(null)
                        router.push({
                          pathname: "/artist/book/[slug]",
                          params: { slug },
                        })
                      }}
                    />
                  ) : null}
                  {upcomingStatuses.includes(selected.status) ? (
                    canCancelWithNotice(
                      selected.startsAt,
                      selected.cancelNoticeHours ?? CUSTOMER_CANCEL_MIN_NOTICE_HOURS,
                    ).allowed ? (
                      <Button
                        label="Cancel booking"
                        variant="ghost"
                        onPress={() => setCancelOpen(true)}
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
                </>
              ) : (
                <>
                  <Button
                    label="View salon"
                    onPress={() => {
                      const id = selected.salonId
                      setSelected(null)
                      router.push({ pathname: "/salon/[id]", params: { id } })
                    }}
                  />
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
                      {canCancelWithNotice(
                        selected.startsAt,
                        selected.cancelNoticeHours ?? CUSTOMER_CANCEL_MIN_NOTICE_HOURS,
                      ).allowed ? (
                        <Button
                          label="Cancel booking"
                          variant="ghost"
                          onPress={() => setCancelOpen(true)}
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
                      variant="secondary"
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
                    variant="secondary"
                    onPress={() => {
                      const id = selected.salonId
                      setSelected(null)
                      router.push({ pathname: "/salon/[id]", params: { id } })
                    }}
                  />
                </>
              )}
            </View>
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={cancelOpen}
        title="Cancel booking"
        onClose={() => setCancelOpen(false)}
      >
        <View style={styles.sheetBody}>
          <Text muted>
            {(selected?.cancelNoticeHours ?? CUSTOMER_CANCEL_MIN_NOTICE_HOURS) <= 0
              ? "You can cancel until the appointment starts. Tell us why you are cancelling."
              : `Free cancellation until ${selected?.cancelNoticeHours ?? CUSTOMER_CANCEL_MIN_NOTICE_HOURS} hours before your appointment. Tell us why you are cancelling.`}
          </Text>
          {selected?.cancelRefundNote ? (
            <Text style={styles.refundNote}>{selected.cancelRefundNote}</Text>
          ) : null}
          {selected ? (
            <Text variant="caption" muted>
              {formatBookingWhen(selected)} · {selected.salonName}
            </Text>
          ) : null}
          {cancelReasonsFor(selected && isArtistBooking(selected) ? "artist" : "salon").map(
            (reason) => (
              <Pressable
                key={reason.id}
                style={[styles.reasonRow, cancelReason === reason.id && styles.chipActive]}
                onPress={() => setCancelReason(reason.id)}
              >
                <Text color={cancelReason === reason.id ? colors.coral : colors.text}>
                  {reason.label}
                </Text>
              </Pressable>
            ),
          )}
          <Input
            label="Extra note"
            value={cancelNote}
            onChangeText={setCancelNote}
            placeholder={cancelReason === "other" ? "Required for Other" : "Optional"}
          />
          <Button
            label="Confirm cancel"
            loading={cancelling}
            onPress={async () => {
              if (!selected) return
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
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  )
}

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
    backgroundColor: "#FFF7F5",
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
    borderColor: colors.coral,
    backgroundColor: "#FFF7F5",
  },
  chipLabelActive: {
    fontFamily: "Inter_600SemiBold",
  },
  countPill: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
  },
  countPillActive: {
    backgroundColor: "#FFE8E3",
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
    fontFamily: "Inter_600SemiBold",
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
    backgroundColor: "#FFF7F5",
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
    backgroundColor: colors.coral,
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
  payCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: "#FFF7F5",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFD5CE",
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
