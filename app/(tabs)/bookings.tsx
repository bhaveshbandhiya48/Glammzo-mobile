import { useCallback, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { BookingsEmptyState } from "@/components/bookings/BookingsEmptyState"
import { DownloadInvoiceButton } from "@/components/bookings/DownloadInvoiceButton"
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
  formatDuration,
  getBookingStatusLabel,
  isArtistBooking,
  serviceSummary,
  statusBadgeColors,
} from "@/lib/booking-display"
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

const CANCEL_REASONS = [
  { id: "change_of_plans", label: "Change of plans" },
  { id: "found_another", label: "Found another salon" },
  { id: "different_time", label: "Timing no longer works" },
  { id: "other", label: "Other" },
] as const

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

function MetaChip({
  icon,
  label,
  value,
}: {
  icon: "calendar-outline" | "time-outline" | "timer-outline" | "person-outline"
  label: string
  value: string
}) {
  return (
    <View style={styles.metaChip}>
      <View style={styles.metaLabelRow}>
        <Icon name={icon} size={12} color={colors.textSubtle} />
        <Text variant="label" muted style={styles.metaLabel}>
          {label}
        </Text>
      </View>
      <Text variant="caption" numberOfLines={1} style={styles.metaValue}>
        {value}
      </Text>
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
  const duration = bookingDurationMin(booking)

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, minWidth: 0, gap: spacing.sm }}>
          <View style={styles.titleRow}>
            <Text variant="bodyStrong" style={{ flexShrink: 1 }} numberOfLines={2}>
              {booking.salonName}
            </Text>
            <StatusBadge status={booking.status} />
          </View>
          {isArtistBooking(booking) ? (
            <Text variant="caption" color={colors.coral} numberOfLines={1}>
              Solo artist
            </Text>
          ) : null}
          <View style={styles.areaRow}>
            <Icon name="location-outline" size={14} color={colors.textMuted} />
            <Text variant="caption" muted numberOfLines={1}>
              {booking.salonArea || "—"}
            </Text>
          </View>
        </View>
        <View style={styles.chevron}>
          <Icon name="chevron-forward" size={16} color={colors.textSubtle} />
        </View>
      </View>

      <View style={styles.metaGrid}>
        <MetaChip
          icon="calendar-outline"
          label="Date"
          value={formatBookingDate(booking.date)}
        />
        <MetaChip icon="time-outline" label="Time" value={booking.time || "—"} />
        <MetaChip
          icon="timer-outline"
          label="Duration"
          value={`~${formatDuration(duration)}`}
        />
        {booking.staffName && !isArtistBooking(booking) ? (
          <MetaChip
            icon="person-outline"
            label="Stylist"
            value={booking.staffName}
          />
        ) : null}
      </View>

      <View style={styles.cardFooter}>
        <Text variant="caption" muted style={{ flex: 1 }} numberOfLines={1}>
          {serviceSummary(booking)}
        </Text>
        <Text variant="bodyStrong">₹{Math.round(booking.price)}</Text>
      </View>
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
  const [cancelReason, setCancelReason] = useState<(typeof CANCEL_REASONS)[number]["id"]>(
    "change_of_plans",
  )
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

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  if (!authChecked || (!authed && loading)) {
    return (
      <Screen edges={["top", "left", "right"]} contentStyle={styles.screen}>
        <Text variant="title">My bookings</Text>
        <Text muted style={styles.gap}>
          Upcoming visits and past appointments.
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
          Upcoming visits and past appointments.
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

  return (
    <Screen edges={["top", "left", "right"]} contentStyle={styles.screen}>
      <Text variant="title">My bookings</Text>
      <Text muted style={styles.gap}>
        Upcoming visits and past appointments.
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
                <Text variant="caption" color={active ? colors.coral : colors.text}>
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
        title="Appointment"
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <View style={styles.sheetBody}>
            <View style={styles.sheetHeader}>
              <Text variant="heading" style={{ flex: 1 }}>
                {selected.salonName}
              </Text>
              <StatusBadge status={selected.status} />
            </View>
            <Text muted>
              {isArtistBooking(selected) ? "Solo artist · " : ""}
              {selected.salonArea}
              {!isArtistBooking(selected) && selected.id
                ? ` · #${selected.id.slice(0, 8)}`
                : ""}
            </Text>

            <View style={styles.metaGrid}>
              <MetaChip
                icon="calendar-outline"
                label="Date"
                value={formatBookingDate(selected.date)}
              />
              <MetaChip icon="time-outline" label="Time" value={selected.time || "—"} />
              <MetaChip
                icon="timer-outline"
                label="Duration"
                value={`~${formatDuration(bookingDurationMin(selected))}`}
              />
              <MetaChip
                icon="person-outline"
                label={isArtistBooking(selected) ? "Artist" : "Stylist"}
                value={
                  isArtistBooking(selected)
                    ? selected.salonName
                    : selected.staffName?.trim() || "Any available"
                }
              />
            </View>

            <View style={styles.servicesBlock}>
              <Text variant="label" muted>
                Services
              </Text>
              {selected.services.map((service) => (
                <View key={service.id} style={styles.serviceRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{service.name}</Text>
                    <Text variant="caption" muted>
                      {formatDuration(service.durationMin)}
                    </Text>
                  </View>
                  <Text>₹{Math.round(service.price)}</Text>
                </View>
              ))}
            </View>

            {selected.declineReason?.trim() ? (
              <Text variant="caption" color={colors.destructive}>
                {selected.declineReason}
              </Text>
            ) : null}
            {selected.notes?.trim() ? (
              <Text variant="caption" muted>
                {isArtistBooking(selected) ? selected.notes : `Note · ${selected.notes}`}
              </Text>
            ) : null}

            <View style={styles.payRow}>
              <Text muted>
                {isArtistBooking(selected)
                  ? selected.status === "pending"
                    ? "Advance pending"
                    : "Artist booking"
                  : selected.status === "completed"
                    ? "Paid at salon"
                    : "Pay at salon"}
              </Text>
              <Text variant="heading">₹{Math.round(selected.price)}</Text>
            </View>

            {canDownloadBookingInvoice(selected) ? (
              <DownloadInvoiceButton
                bookingId={selected.crmAppointmentId ?? selected.id}
              />
            ) : null}

            {isArtistBooking(selected) ? (
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
                {(selected.artistSlug || selected.salonId) &&
                upcomingStatuses.includes(selected.status) ? (
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
                  <Text variant="caption" muted>
                    To change or cancel this visit, contact the artist directly.
                  </Text>
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
                      <Text variant="caption" muted>
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
                      <Text variant="caption" muted>
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
          {CANCEL_REASONS.map((reason) => (
            <Pressable
              key={reason.id}
              style={[styles.reasonRow, cancelReason === reason.id && styles.chipActive]}
              onPress={() => setCancelReason(reason.id)}
            >
              <Text color={cancelReason === reason.id ? colors.coral : colors.text}>
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
            onPress={async () => {
              if (!selected) return
              if (cancelReason === "other" && !cancelNote.trim()) {
                showToast("Please add a note for Other")
                return
              }
              setCancelling(true)
              try {
                await cancelBooking(selected.id, {
                  reasonId: cancelReason,
                  details: cancelNote.trim() || undefined,
                })
                setCancelOpen(false)
                setSelected(null)
                setCancelNote("")
                showToast("Booking cancelled")
                await reloadBookings()
              } catch (err) {
                showToast(err instanceof ApiError ? err.message : "Cancel failed")
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
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.94,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  areaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chevron: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
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
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  metaChip: {
    width: "47%",
    flexGrow: 1,
    minWidth: "42%",
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  metaLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaLabel: {
    letterSpacing: 0.8,
    fontSize: 9,
  },
  metaValue: {
    fontFamily: "Inter_600SemiBold",
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
  sheetBody: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  servicesBlock: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
