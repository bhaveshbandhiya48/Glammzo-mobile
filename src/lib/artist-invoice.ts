import type { Booking } from "@/data/types"
import { formatBookingDate, formatDuration } from "@/lib/booking-display"
import { formatRupees } from "@/lib/service-pricing"

/** Plain-text invoice summary for WhatsApp / share sheet. */
export function buildArtistInvoiceMessage(booking: Booking): string {
  const when = formatBookingDate(booking.date)
  const services =
    booking.services?.map((s) => `• ${s.name} — ${formatRupees(s.price)}`).join("\n") ||
    "• Service"
  const location = booking.notes?.trim() || booking.salonArea || "Visit"
  const duration =
    booking.durationMin > 0 ? formatDuration(booking.durationMin) : null

  const lines = [
    "Glammzo booking invoice",
    "",
    `Artist: ${booking.salonName}`,
    `When: ${when}${booking.time ? ` · ${booking.time}` : ""}`,
    `Where: ${location}`,
    duration ? `Duration: ${duration}` : null,
    "",
    "Services:",
    services,
    "",
    `Total: ${formatRupees(booking.price)}`,
    "Pay artist directly.",
    "",
    "Booked via Glammzo",
  ]

  return lines.filter((line): line is string => line != null).join("\n")
}
