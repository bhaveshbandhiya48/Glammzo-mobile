import { StyleSheet, View } from "react-native"

import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Booking } from "@/data/types"
import { formatBookingWhen, isArtistBooking } from "@/lib/booking-display"
import { formatRupees } from "@/lib/service-pricing"
import { fontFamily } from "@/theme/tokens"

type StepState = "done" | "current" | "todo" | "stopped"
type Step = { key: string; title: string; detail?: string; state: StepState }

function formatCreated(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

/** What happened to a paid advance after cancelling. */
function refundLine(booking: Booking): string | undefined {
  if (!booking.advancePaid || !booking.advanceAmount) return undefined
  const amount = booking.refundAmount ?? 0
  switch (booking.refundStatus) {
    case "processed":
      return `${formatRupees(amount)} refunded to your original payment method`
    case "pending":
      return `${formatRupees(amount)} refund on its way (usually 5–7 working days)`
    case "failed":
      return "Refund delayed. Our team is on it and will contact you."
    case "none":
      return amount > 0 ? undefined : "No refund under the cancellation policy"
    default:
      return undefined
  }
}

/** Where a booking stands, step by step. */
export function bookingSteps(booking: Booking): Step[] {
  const artist = isArtistBooking(booking)
  const steps: Step[] = [{ key: "booked", title: "Booked", detail: formatCreated(booking.createdAt), state: "done" }]

  if (booking.status === "payment_failed") {
    steps.push({
      key: "stopped",
      title: "Payment failed",
      detail: "The advance wasn't paid in time, so this slot was released.",
      state: "stopped",
    })
    return steps
  }

  if (booking.status === "cancelled" || booking.status === "declined" || booking.status === "expired") {
    steps.push({
      key: "stopped",
      title:
        booking.status === "declined"
          ? `Declined by the ${artist ? "artist" : "salon"}`
          : booking.status === "expired"
            ? "Request expired"
            : "Cancelled",
      detail: refundLine(booking),
      state: "stopped",
    })
    return steps
  }

  const visitDone = booking.status === "completed"
  if (booking.advanceAmount) {
    steps.push({
      key: "advance",
      title: booking.advancePaid ? "Advance paid" : "Pay the advance",
      detail: formatRupees(booking.advanceAmount),
      state: booking.advancePaid || visitDone ? "done" : "current",
    })
  }
  if (!artist) {
    const confirmed = booking.status !== "pending"
    steps.push({
      key: "confirmed",
      title: confirmed ? "Confirmed by the salon" : "Waiting for the salon to confirm",
      state: confirmed ? "done" : "current",
    })
  }
  const waiting = steps.some((step) => step.state === "current")
  steps.push({
    key: "visit",
    title: visitDone ? "Visit completed" : "Your visit",
    detail: formatBookingWhen(booking),
    state: visitDone ? "done" : waiting ? "todo" : "current",
  })
  steps.push({
    key: "review",
    title: booking.hasVerifiedReview ? "Review shared" : "Leave a review",
    state: booking.hasVerifiedReview ? "done" : visitDone ? "current" : "todo",
  })
  return steps
}

const INK = "#111111"
const SECONDARY = "#595959"
const MUTED = "#8a8a8a"
const RED = "#c0392b"

const DOT: Record<StepState, { bg: string; border: string; fg: string; icon?: IconName }> = {
  done: { bg: INK, border: INK, fg: "#ffffff", icon: "checkmark" },
  current: { bg: "#ffffff", border: INK, fg: INK },
  todo: { bg: "#ffffff", border: "#d4d4d4", fg: MUTED },
  stopped: { bg: "#fdecea", border: "#fdecea", fg: RED, icon: "close" },
}

/** Connected vertical timeline: the line runs through every step with no gaps. */
export function BookingTimeline({ booking }: { booking: Booking }) {
  const steps = bookingSteps(booking)
  return (
    <View style={styles.wrap} accessibilityRole="list">
      {steps.map((step, index) => {
        const last = index === steps.length - 1
        const dot = DOT[step.state]
        const nextDone = steps[index + 1]?.state === "done"
        return (
          <View
            key={step.key}
            style={styles.row}
            accessible
            accessibilityLabel={`${step.title}${step.detail ? `, ${step.detail}` : ""}${step.state === "current" ? ", current step" : step.state === "done" ? ", done" : ""}`}
          >
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: dot.bg, borderColor: dot.border }]}>
                {dot.icon ? <Icon name={dot.icon} size={12} color={dot.fg} /> : null}
                {step.state === "current" ? <View style={styles.currentInner} /> : null}
              </View>
              {last ? null : <View style={[styles.line, nextDone && styles.lineDone]} />}
            </View>
            <View style={[styles.copy, !last && styles.copyGap]}>
              <Text
                style={[
                  styles.title,
                  step.state === "todo" && styles.titleTodo,
                  step.state === "stopped" && styles.titleStopped,
                ]}
              >
                {step.title}
              </Text>
              {step.detail ? <Text style={styles.detail}>{step.detail}</Text> : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const DOT_SIZE = 22

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  rail: {
    width: DOT_SIZE,
    alignItems: "center",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  currentInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: INK,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: "#ececec",
  },
  lineDone: {
    backgroundColor: INK,
  },
  copy: {
    flex: 1,
    minHeight: DOT_SIZE,
    paddingTop: 1,
  },
  copyGap: {
    paddingBottom: 16,
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: INK,
  },
  titleTodo: {
    fontFamily: fontFamily.medium,
    color: MUTED,
  },
  titleStopped: {
    color: RED,
  },
  detail: {
    marginTop: 1,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: SECONDARY,
  },
})
