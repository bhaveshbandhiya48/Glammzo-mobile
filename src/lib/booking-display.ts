import type { Booking, BookingStatus } from "@/data/types"
import { colors, status as statusTint } from "@/theme/tokens"

export const FILTER_LABELS = {
  all: "All",
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
} as const

export function isArtistBooking(booking: Booking): boolean {
  return booking.kind === "artist" || booking.id.startsWith("artist:")
}

export function getBookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "pending":
      return "Pending"
    case "confirmed":
      return "Confirmed"
    case "declined":
      return "Declined"
    case "expired":
      return "Expired"
    case "cancelled":
      return "Cancelled"
    case "payment_failed":
      return "Payment failed"
    case "completed":
      return "Completed"
    case "upcoming":
      return "Upcoming"
    default:
      return status
  }
}

/** Partner-app status tints: pending amber, confirmed blue, completed green, cancelled/declined red. */
export function statusBadgeColors(status: BookingStatus): {
  text: string
  bg: string
  border: string
  dot: string
} {
  const tint = (fg: string, bg: string) => ({ text: fg, bg, border: bg, dot: fg })
  switch (status) {
    case "pending":
      return tint(statusTint.warnFg, statusTint.warnBg)
    case "confirmed":
    case "upcoming":
      return tint(statusTint.infoFg, statusTint.infoBg)
    case "completed":
      return tint(statusTint.successFg, statusTint.successBg)
    case "cancelled":
    case "declined":
    case "payment_failed":
      return tint(statusTint.dangerFg, statusTint.dangerBg)
    default:
      return tint(colors.textMuted, colors.muted)
  }
}

export function formatBookingDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Compact date for list cards, e.g. "Sat, 18 Oct". */
export function formatBookingDateShort(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

/** Today / Tomorrow / Yesterday relative to local calendar, else null. */
export function relativeBookingDay(isoDate: string, now = new Date()): string | null {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const startOf = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const diffDays = Math.round((startOf(d) - startOf(now)) / 86_400_000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays === -1) return "Yesterday"
  return null
}

export function visitTypeLabel(booking: Booking): string | null {
  if (!isArtistBooking(booking)) return null
  const note = booking.notes?.trim().toLowerCase() ?? ""
  if (note.includes("home")) return "Home visit"
  if (note.includes("studio")) return "Studio visit"
  return booking.notes?.trim() || null
}

export function formatBookingWhen(booking: Booking): string {
  const relative = relativeBookingDay(booking.date)
  const date = relative ?? formatBookingDateShort(booking.date)
  const time = booking.time?.trim() || "—"
  return `${date} · ${time}`
}

export function formatDuration(totalMin: number): string {
  if (!totalMin || totalMin < 0) return "—"
  if (totalMin < 60) return `${totalMin} min`
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (mins === 0) return `${hours} hr`
  return `${hours} hr ${mins} min`
}

export function serviceSummary(booking: Booking): string {
  const count = booking.services.length
  if (count === 0) return "Services"
  if (count === 1) return booking.services[0]?.name ?? "1 service"
  return `${count} services`
}

export function bookingDurationMin(booking: Booking): number {
  if (booking.durationMin > 0) return booking.durationMin
  return booking.services.reduce((sum, s) => sum + (s.durationMin || 0), 0)
}

/** Invoice PDFs are created only when CRM status is truly `completed`. */
export function canDownloadBookingInvoice(booking: Booking): boolean {
  if (isArtistBooking(booking)) return false
  return Boolean(booking.isCrmCompleted && (booking.crmAppointmentId || booking.id))
}
