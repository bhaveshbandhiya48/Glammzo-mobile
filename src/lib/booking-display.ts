import type { Booking, BookingStatus } from "@/data/types"
import { colors } from "@/theme/tokens"

export const FILTER_LABELS = {
  all: "All",
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
} as const

export function getBookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "pending":
      return "Pending Confirmation"
    case "confirmed":
      return "Confirmed"
    case "declined":
      return "Rejected"
    case "expired":
      return "Expired"
    case "cancelled":
      return "Cancelled"
    case "completed":
      return "Completed"
    case "upcoming":
      return "Upcoming"
    default:
      return status
  }
}

export function statusBadgeColors(status: BookingStatus): {
  text: string
  bg: string
  border: string
  dot: string
} {
  switch (status) {
    case "pending":
      return { text: "#78350F", bg: "#FFFBEB", border: "#FCD34D", dot: "#F59E0B" }
    case "confirmed":
    case "upcoming":
      return { text: "#064E3B", bg: "#ECFDF5", border: "#6EE7B7", dot: "#10B981" }
    case "completed":
      return {
        text: colors.textMuted,
        bg: colors.muted,
        border: colors.border,
        dot: colors.textSubtle,
      }
    case "cancelled":
      return {
        text: colors.textMuted,
        bg: colors.muted,
        border: colors.border,
        dot: colors.textSubtle,
      }
    case "declined":
      return { text: "#7F1D1D", bg: "#FEF2F2", border: "#FCA5A5", dot: "#EF4444" }
    case "expired":
      return { text: "#7C2D12", bg: "#FFF7ED", border: "#FDBA74", dot: "#F97316" }
    default:
      return {
        text: colors.textMuted,
        bg: colors.muted,
        border: colors.border,
        dot: colors.textSubtle,
      }
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
