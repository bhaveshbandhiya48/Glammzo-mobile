import type { ReactNode } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"

import { advanceDueToken, BookingPayStrip } from "@/components/bookings/BookingPayStrip"
import { ActionPill, bookingTags, StatusPill } from "@/components/bookings/BookingPills"
import { BookingTimeline } from "@/components/bookings/BookingTimeline"
import { DownloadInvoiceButton } from "@/components/bookings/DownloadInvoiceButton"
import { RefundPreview } from "@/components/bookings/RefundPreview"
import { PhotoFallback } from "@/components/home/PhotoFallback"
import { sp, ui } from "@/components/salon-page/theme"
import { Input } from "@/components/ui/Input"
import { Text } from "@/components/ui/Text"
import type { Booking } from "@/data/types"
import {
  bookingDurationMin,
  canDownloadBookingInvoice,
  formatBookingDate,
  formatBookingDateShort,
  formatBookingWhen,
  formatDuration,
  isArtistBooking,
  relativeBookingDay,
  visitTypeLabel,
} from "@/lib/booking-display"
import {
  canCustomerCancelBooking,
  CUSTOMER_CANCEL_MIN_NOTICE_HOURS,
  getCancelBlockedReason,
} from "@/lib/cancel-policy"
import { canOpenReschedule, getRescheduleBlockedReason, hasPendingArtistReschedule } from "@/lib/reschedule-policy"
import { formatRupees } from "@/lib/service-pricing"
import { openDirections } from "@/lib/visit-links"
import { fontFamily } from "@/theme/tokens"

const RED = "#c0392b"
const upcomingStatuses = ["pending", "confirmed", "upcoming"]

/** Tax or charges the salon billed on top of the listed services (0 when none). */
function salonExtrasAmount(booking: Booking): number {
  const services = booking.services.reduce((sum, item) => sum + item.price, 0)
  const extra = Math.round((booking.price - services) * 100) / 100
  return services > 0 && extra > 0 ? extra : 0
}

function paymentLine(booking: Booking): string {
  const artist = isArtistBooking(booking)
  const extras = !artist ? salonExtrasAmount(booking) : 0
  if (artist) {
    if (booking.advanceAmount && booking.advancePaid) {
      return `${formatRupees(booking.advanceAmount)} advance paid · ${formatRupees(Math.max(0, booking.price - booking.advanceAmount))} at the visit`
    }
    if (booking.advanceAmount && advanceDueToken(booking)) {
      return `${formatRupees(booking.advanceAmount)} advance due now · rest at the visit`
    }
    return "Pay artist directly"
  }
  if (booking.advanceAmount && booking.advancePaid) {
    return `${formatRupees(booking.advanceAmount)} advance paid · rest at the salon`
  }
  if (booking.advanceAmount && advanceDueToken(booking)) {
    return `${formatRupees(booking.advanceAmount)} advance due now · rest at the salon`
  }
  const base = booking.status === "completed" ? "Paid at salon" : "Pay at salon"
  return extras > 0 ? `${base} · includes ${formatRupees(extras)} tax and charges` : base
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[ui.sectionLabel, styles.sectionLabel]}>{label}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  )
}

function ReceiptRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={[styles.receiptLabel, strong && styles.totalText]}>{label}</Text>
      <Text style={[styles.receiptValue, strong && styles.totalText]}>{value}</Text>
    </View>
  )
}

/** Full-width sheet button: black, outline, or quiet red text. */
function SheetButton({
  label,
  onPress,
  tone = "primary",
  loading,
  disabled,
}: {
  label: string
  onPress: () => void
  tone?: "primary" | "outline" | "danger"
  loading?: boolean
  disabled?: boolean
}) {
  const inactive = Boolean(disabled || loading)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "primary" && styles.buttonPrimary,
        tone === "outline" && styles.buttonOutline,
        tone === "danger" && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && ui.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone === "primary" ? "#ffffff" : sp.text} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            tone === "primary" && styles.buttonTextPrimary,
            tone === "danger" && styles.buttonTextDanger,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

export type BookingDetailsSheetProps = {
  booking: Booking
  onPaymentExpired: () => void
  onViewProvider: () => void
  onReview: () => void
  onBookAgain: () => void
  onReschedule: () => void
  onStartCancel: () => void
  /** Same rules as the list's Rate pill. */
  canReview: boolean
}

/** "Appointment details" body: header, services receipt, where, payment, policy and actions. */
export function BookingDetailsSheet({
  booking,
  onPaymentExpired,
  onViewProvider,
  onReview,
  onBookAgain,
  onReschedule,
  onStartCancel,
  canReview,
}: BookingDetailsSheetProps) {
  const artist = isArtistBooking(booking)
  const visit = visitTypeLabel(booking)
  const visitDone = booking.status === "completed"
  const upcoming = upcomingStatuses.includes(booking.status)
  const providerSlug = booking.artistSlug || booking.salonId
  const relative = relativeBookingDay(booking.date)
  const duration = bookingDurationMin(booking)
  const tags = artist ? bookingTags(booking) : ["Salon"]

  const servicesTotal = booking.services.reduce((sum, item) => sum + item.price, 0)
  const extras = !artist ? salonExtrasAmount(booking) : 0
  const hasBreakdown = Boolean(booking.travelFee) || extras > 0

  const cancelAllowed = upcoming && canCustomerCancelBooking(booking).allowed
  const rescheduleAllowed = upcoming && canOpenReschedule(booking)
  const pendingMove = hasPendingArtistReschedule(booking)
  const policyLines: (string | null)[] = []
  if (upcoming && !artist && !rescheduleAllowed) policyLines.push(getRescheduleBlockedReason(booking.startsAt))
  if (pendingMove) policyLines.push("You asked the artist for a new time. They'll reply soon; until then your booking stays as it is.")
  if (upcoming && !cancelAllowed) {
    const hours = booking.cancelNoticeHours ?? CUSTOMER_CANCEL_MIN_NOTICE_HOURS
    policyLines.push(artist ? getCancelBlockedReason(booking.startsAt, hours, "artist") : getCancelBlockedReason(booking.startsAt, hours))
  }

  // Same rule as the Next visit card: salon visits with nothing left to pay.
  const canDirect = !artist && !advanceDueToken(booking)
  const bookAgainShown = artist ? Boolean(providerSlug) && (upcoming || visitDone) : true
  const bookAgainPrimary = visitDone && Boolean(booking.hasVerifiedReview)
  const viewLabel = artist ? "View artist" : "View salon"

  return (
    <View style={styles.body}>
      <View style={styles.header}>
        <View style={styles.headTop}>
          <View style={styles.squircle}>
            <PhotoFallback name={booking.salonName} />
          </View>
          <View style={styles.headText}>
            <Text style={styles.name} numberOfLines={2}>
              {booking.salonName}
            </Text>
            <StatusPill status={booking.status} />
          </View>
        </View>
        <Text style={styles.when} accessibilityRole="header">
          {formatBookingDateShort(booking.date)} · {booking.time?.trim() || "—"}
        </Text>
        <Text style={styles.whenSub}>
          {[relative, formatBookingDate(booking.date), duration > 0 ? `About ${formatDuration(duration)}` : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <View style={styles.tags}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {!artist && booking.id ? (
            <Text style={styles.bookingId}>Booking #{booking.id.slice(0, 8).toUpperCase()}</Text>
          ) : null}
        </View>
      </View>

      <Section label="Progress">
        <View style={styles.pad}>
          <BookingTimeline booking={booking} />
        </View>
      </Section>

      <Section label="Services">
        <View style={styles.pad}>
          {booking.services.length === 0 ? (
            <Text style={styles.muted}>No services listed</Text>
          ) : (
            booking.services.map((service) => (
              <View key={service.id} style={styles.serviceRow}>
                <View style={styles.flex}>
                  <Text style={styles.serviceName} numberOfLines={2}>
                    {service.name}
                  </Text>
                  <Text style={styles.muted}>{formatDuration(service.durationMin)}</Text>
                </View>
                <Text style={styles.servicePrice}>{formatRupees(service.price)}</Text>
              </View>
            ))
          )}
          <View style={styles.dashed} />
          {hasBreakdown && booking.services.length > 0 ? (
            <ReceiptRow label="Subtotal" value={formatRupees(servicesTotal)} />
          ) : null}
          {booking.travelFee ? <ReceiptRow label="Travel fee" value={formatRupees(booking.travelFee)} /> : null}
          {extras > 0 ? <ReceiptRow label="Tax and charges" value={formatRupees(extras)} /> : null}
          <ReceiptRow label="Total" value={formatRupees(booking.price)} strong />
        </View>
      </Section>

      <Section label="Where">
        <View style={styles.pad}>
          <Text style={styles.whereMain}>{booking.salonArea || "—"}</Text>
          {visit ? <Text style={styles.muted}>{visit}</Text> : null}
          <Text style={styles.whereStaff}>
            {artist ? "With " : "Stylist: "}
            <Text style={styles.whereStaffName}>
              {artist ? booking.salonName : booking.staffName?.trim() || "Any available"}
            </Text>
          </Text>
          {canDirect ? (
            <View style={styles.pillRow}>
              <ActionPill
                small
                outline
                icon="navigate-outline"
                label="Directions"
                onPress={() =>
                  openDirections({ query: [booking.salonName, booking.salonArea].filter(Boolean).join(", ") })
                }
              />
            </View>
          ) : null}
        </View>
      </Section>

      {booking.declineReason?.trim() ? (
        <View style={styles.alert}>
          <Text style={styles.alertText}>{booking.declineReason}</Text>
        </View>
      ) : null}

      {!artist && booking.notes?.trim() ? (
        <Section label="Note">
          <View style={styles.pad}>
            <Text style={styles.bodyText}>{booking.notes.trim()}</Text>
          </View>
        </Section>
      ) : null}

      {booking.hasVerifiedReview && booking.review ? (
        <Section label="Your review">
          <View style={styles.pad}>
            <View style={styles.reviewHead}>
              <View style={styles.ratingPill}>
                <Text style={styles.ratingText}>★ {booking.review.rating.toFixed(1)}</Text>
              </View>
              <Text style={[styles.serviceName, styles.flex]} numberOfLines={2}>
                {booking.review.reviewType || "Overall experience"}
              </Text>
            </View>
            {booking.review.comment ? <Text style={styles.bodyText}>{booking.review.comment}</Text> : null}
          </View>
        </Section>
      ) : null}

      <Section label="Payment">
        <View style={styles.pad}>
          <View style={styles.payRow}>
            <Text style={[styles.bodyText, styles.flex]}>{paymentLine(booking)}</Text>
            <Text style={styles.totalText}>{formatRupees(booking.price)}</Text>
          </View>
          <BookingPayStrip booking={booking} onExpired={onPaymentExpired} />
          {!artist && canDownloadBookingInvoice(booking) ? (
            <DownloadInvoiceButton bookingId={booking.crmAppointmentId ?? booking.id} />
          ) : null}
        </View>
      </Section>

      {policyLines.some(Boolean) ? (
        <Section label="Policy">
          <View style={styles.pad}>
            {policyLines.filter(Boolean).map((line) => (
              <Text key={line} style={styles.bodyText}>
                {line}
              </Text>
            ))}
          </View>
        </Section>
      ) : null}

      <View style={styles.actions}>
        {!visitDone && providerSlug ? <SheetButton label={viewLabel} onPress={onViewProvider} /> : null}
        {rescheduleAllowed ? (
          <SheetButton label={pendingMove ? "View time request" : "Reschedule"} tone="outline" onPress={onReschedule} />
        ) : null}
        {canReview ? <SheetButton label="Leave a review" onPress={onReview} /> : null}
        {bookAgainShown ? (
          <SheetButton label="Book again" tone={bookAgainPrimary ? "primary" : "outline"} onPress={onBookAgain} />
        ) : null}
        {visitDone && providerSlug ? <SheetButton label={viewLabel} tone="outline" onPress={onViewProvider} /> : null}
        {cancelAllowed ? <SheetButton label="Cancel booking" tone="danger" onPress={onStartCancel} /> : null}
      </View>
    </View>
  )
}

type Reason<T extends string> = { id: T; label: string }

/** "Cancel booking" step: policy copy, refund preview, reason chips, note and confirm. */
export function CancelBookingSheet<T extends string>({
  booking,
  reasons,
  reason,
  onReason,
  note,
  onNote,
  cancelling,
  onConfirm,
  onKeep,
}: {
  booking: Booking
  reasons: Reason<T>[]
  reason: T
  onReason: (id: T) => void
  note: string
  onNote: (value: string) => void
  cancelling: boolean
  onConfirm: () => void
  onKeep: () => void
}) {
  const hours = booking.cancelNoticeHours ?? CUSTOMER_CANCEL_MIN_NOTICE_HOURS
  return (
    <View style={styles.body}>
      <Text style={styles.bodyText}>
        {booking.status === "pending"
          ? "This booking is still waiting for confirmation. You can cancel the request anytime."
          : hours <= 0
            ? "You can cancel until the appointment starts. Tell us why you are cancelling."
            : `Free cancellation until ${hours} hours before your appointment. Tell us why you are cancelling.`}
      </Text>
      {booking.cancelRefund ? (
        <RefundPreview booking={booking} />
      ) : booking.cancelRefundNote ? (
        <View style={styles.peach}>
          <Text style={styles.peachText}>{booking.cancelRefundNote}</Text>
        </View>
      ) : null}
      <Text style={styles.muted}>
        {formatBookingWhen(booking)} · {booking.salonName}
      </Text>
      <View style={styles.section}>
        <Text style={[ui.sectionLabel, styles.sectionLabel]}>Reason</Text>
        <View style={styles.chips}>
          {reasons.map((item) => {
            const active = reason === item.id
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onReason(item.id)}
                style={({ pressed }) => [ui.chip, active && ui.chipActive, pressed && ui.pressed]}
              >
                <Text style={[ui.chipText, active && ui.chipTextActive]}>{item.label}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
      <Input
        label="Extra note"
        value={note}
        onChangeText={onNote}
        placeholder={reason === "other" ? "Required for Other" : "Optional"}
      />
      <View style={styles.actions}>
        <SheetButton label="Confirm cancel" loading={cancelling} onPress={onConfirm} />
        <SheetButton label="Keep booking" tone="outline" disabled={cancelling} onPress={onKeep} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  header: { gap: 8 },
  headTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  squircle: { width: 56, height: 56, borderRadius: 16, overflow: "hidden" },
  headText: { flex: 1, minWidth: 0, gap: 6 },
  name: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, color: sp.text },
  when: { marginTop: 4, fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, color: sp.text },
  whenSub: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: sp.secondary },
  tags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 2 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: sp.grey },
  tagText: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 15, color: sp.secondary },
  bookingId: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 15, color: sp.secondary, marginLeft: 2 },
  section: { gap: 8 },
  sectionLabel: { paddingHorizontal: 4 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  pad: { padding: 14, gap: 10 },
  muted: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: sp.secondary },
  bodyText: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: sp.text },
  serviceRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  serviceName: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: sp.text },
  servicePrice: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: sp.text },
  dashed: { borderTopWidth: 1, borderStyle: "dashed", borderColor: sp.border, marginVertical: 2 },
  receiptRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  receiptLabel: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 19, color: sp.secondary },
  receiptValue: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 19, color: sp.text },
  totalText: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22, color: sp.text },
  whereMain: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: sp.text },
  whereStaff: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 19, color: sp.secondary },
  whereStaffName: { fontFamily: fontFamily.semibold, color: sp.text },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  alert: { padding: 12, borderRadius: 12, backgroundColor: "#fdecea" },
  alertText: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: RED },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: sp.ratingBg },
  ratingText: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, color: sp.ratingInk },
  payRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  actions: { gap: 10, marginTop: 4 },
  button: {
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  buttonPrimary: { backgroundColor: sp.text },
  buttonOutline: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: sp.border },
  buttonDanger: { height: 44, backgroundColor: "transparent" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: sp.text },
  buttonTextPrimary: { color: "#ffffff" },
  buttonTextDanger: { color: RED },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  peach: { padding: 12, borderRadius: 12, backgroundColor: sp.peachBg },
  peachText: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: sp.peachInk },
})
