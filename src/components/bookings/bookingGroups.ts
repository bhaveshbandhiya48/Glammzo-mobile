import type { Booking } from "@/data/types"
import { formatBookingDateShort, relativeBookingDay, serviceSummary } from "@/lib/booking-display"

/** "4:30 PM" → minutes after midnight, or null. */
function timeMinutes(value: string | undefined): number | null {
  const match = value?.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?$/)
  if (!match) return null
  let hours = Number(match[1]) % 24
  const ap = match[3]?.toLowerCase()
  if (ap === "pm" && hours < 12) hours += 12
  if (ap === "am" && hours === 12) hours = 0
  return hours * 60 + Number(match[2] ?? 0)
}

export function bookingSortMs(booking: Booking): number {
  if (booking.startsAt) {
    const at = Date.parse(booking.startsAt)
    if (Number.isFinite(at)) return at
  }
  const day = Date.parse(`${booking.date}T00:00:00`)
  if (!Number.isFinite(day)) return 0
  return day + (timeMinutes(booking.time) ?? 12 * 60) * 60_000
}

export type BookingGroup = { label: string; items: Booking[] }

function startOfDay(ms: number) {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Upcoming (soonest first): "This week" for the next 7 days, then "Later". */
export function groupUpcoming(bookings: Booking[], now = Date.now()): BookingGroup[] {
  const weekEnd = startOfDay(now) + 7 * 86_400_000
  const week: Booking[] = []
  const later: Booking[] = []
  for (const booking of bookings) (bookingSortMs(booking) < weekEnd ? week : later).push(booking)
  return [
    { label: "This week", items: week },
    { label: "Later", items: later },
  ].filter((group) => group.items.length > 0)
}

/** Past (newest first), one group per month: "November 2026". */
export function groupByMonth(bookings: Booking[]): BookingGroup[] {
  const groups: BookingGroup[] = []
  for (const booking of bookings) {
    const d = new Date(`${booking.date}T12:00:00`)
    const label = Number.isNaN(d.getTime())
      ? "Earlier"
      : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(booking)
    else groups.push({ label, items: [booking] })
  }
  return groups
}

/** "Tomorrow · 4:30 PM" or "Sat, 15 Nov · 4:30 PM". */
export function bookingWhenLine(booking: Booking): string {
  const day = relativeBookingDay(booking.date) ?? formatBookingDateShort(booking.date)
  const time = booking.time?.trim()
  return time ? `${day} · ${time}` : day
}

/** Up to two service names, then "+N". */
export function bookingServiceLine(booking: Booking): string {
  const names = booking.services.map((s) => s.name).filter(Boolean)
  if (names.length === 0) return serviceSummary(booking)
  if (names.length <= 2) return names.join(" · ")
  return `${names.slice(0, 2).join(" · ")} +${names.length - 2}`
}
