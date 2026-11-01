import type { Booking } from "@/data/types"
import { formatBookingDateShort } from "@/lib/booking-display"
import type { LoyaltySummary } from "@/lib/loyalty"
import type { WalletLedgerEntry } from "@/lib/wallet-api"

export type AppNotificationType =
  | "booking_confirmed"
  | "booking_pending"
  | "booking_reminder"
  | "booking_completed"
  | "booking_cancelled"
  | "booking_declined"
  | "cashback"
  | "loyalty"

export type AppNotification = {
  id: string
  type: AppNotificationType
  title: string
  body: string
  createdAt: string
  read: boolean
  href?: string
}

function parseBookingStart(booking: Booking): Date | null {
  const date = booking.date?.trim()
  const time = booking.time?.trim()
  if (!date) return null

  // Prefer 24h "HH:MM" if present
  const twentyFour = time?.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFour) {
    const d = new Date(
      `${date}T${twentyFour[1]!.padStart(2, "0")}:${twentyFour[2]}:00`,
    )
    return Number.isNaN(d.getTime()) ? null : d
  }

  const twelve = time?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (twelve) {
    let hours = Number(twelve[1])
    const mins = Number(twelve[2])
    const period = twelve[3]!.toUpperCase()
    if (period === "PM" && hours < 12) hours += 12
    if (period === "AM" && hours === 12) hours = 0
    const d = new Date(
      `${date}T${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`,
    )
    return Number.isNaN(d.getTime()) ? null : d
  }

  const fallback = new Date(`${date}T12:00:00`)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function serviceLine(booking: Booking): string {
  if (booking.services.length === 0) return "your appointment"
  if (booking.services.length === 1) return booking.services[0]!.name
  return `${booking.services.length} services`
}

function bookingNotification(
  booking: Booking,
  type: AppNotificationType,
  title: string,
  body: string,
  createdAt: string,
): AppNotification {
  return {
    id: `booking:${booking.id}:${type}`,
    type,
    title,
    body,
    createdAt,
    read: false,
    href: "/(tabs)/bookings",
  }
}

function fromBookings(bookings: Booking[], now = Date.now()): AppNotification[] {
  const items: AppNotification[] = []

  for (const booking of bookings) {
    const start = parseBookingStart(booking)
    const startIso = start?.toISOString() ?? booking.createdAt
    const when = formatBookingDateShort(booking.date)
    const services = serviceLine(booking)

    switch (booking.status) {
      case "pending":
        items.push(
          bookingNotification(
            booking,
            "booking_pending",
            "Awaiting salon confirmation",
            `${booking.salonName}, ${when}. We'll tell you once they confirm.`,
            booking.createdAt,
          ),
        )
        break
      case "confirmed":
      case "upcoming":
        items.push(
          bookingNotification(
            booking,
            "booking_confirmed",
            "Booking confirmed",
            `${services} at ${booking.salonName}, ${when} at ${booking.time}.`,
            booking.createdAt,
          ),
        )
        if (start) {
          const msUntil = start.getTime() - now
          // Reminder window: upcoming within 24h, still in the future
          if (msUntil > 0 && msUntil <= 24 * 60 * 60 * 1000) {
            const hours = Math.max(1, Math.round(msUntil / (60 * 60 * 1000)))
            items.push(
              bookingNotification(
                booking,
                "booking_reminder",
                hours <= 2
                  ? "Reminder · starting soon"
                  : `Reminder · about ${hours}h to go`,
                `${booking.salonName}, ${when} at ${booking.time}.`,
                startIso,
              ),
            )
          }
        }
        break
      case "completed":
        items.push(
          bookingNotification(
            booking,
            "booking_completed",
            "Visit completed",
            `Thanks for visiting ${booking.salonName}. Tap to leave a review.`,
            startIso,
          ),
        )
        break
      case "cancelled":
        items.push(
          bookingNotification(
            booking,
            "booking_cancelled",
            "Booking cancelled",
            `${booking.salonName}, ${when}.`,
            booking.createdAt,
          ),
        )
        break
      case "declined":
        items.push(
          bookingNotification(
            booking,
            "booking_declined",
            "Booking declined",
            booking.declineReason
              ? `${booking.salonName} declined your request: ${booking.declineReason}`
              : `${booking.salonName} declined your request for ${when}.`,
            booking.createdAt,
          ),
        )
        break
      default:
        break
    }
  }

  return items
}

function fromWalletLedger(ledger: WalletLedgerEntry[]): AppNotification[] {
  return ledger
    .filter((entry) => entry.deltaPaise > 0)
    .map((entry) => {
      const rupees = Math.round(entry.deltaPaise / 100)
      const reason = entry.reason?.trim() || "Wallet credit"
      const isCashback = /cashback|reward|credit|campaign|first/i.test(reason)
      return {
        id: `wallet:${entry.id}`,
        type: "cashback" as const,
        title: isCashback ? `₹${rupees} cashback credited` : `₹${rupees} added to wallet`,
        body: `${reason}. Use it on your next booking.`,
        createdAt: entry.createdAt,
        read: false,
        href: "/profile/wallet",
      }
    })
}

function fromLoyalty(loyalty: LoyaltySummary): AppNotification[] {
  if (loyalty.freeServiceCredits <= 0) return []
  return [
    {
      id: `loyalty:credits:${loyalty.completedVisits}`,
      type: "loyalty",
      title:
        loyalty.freeServiceCredits === 1
          ? "Loyalty credit unlocked"
          : `${loyalty.freeServiceCredits} loyalty credits ready`,
      body: `${loyalty.completedVisits} visits done. A reward is ready for your next booking.`,
      createdAt: new Date().toISOString(),
      read: false,
      href: "/profile/loyalty",
    },
  ]
}

export function buildNotifications(input: {
  bookings: Booking[]
  ledger: WalletLedgerEntry[]
  loyalty: LoyaltySummary
  readIds: Set<string>
  now?: number
}): AppNotification[] {
  const items = [
    ...fromWalletLedger(input.ledger),
    ...fromLoyalty(input.loyalty),
    ...fromBookings(input.bookings, input.now),
  ]

  items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return items.map((item) => ({
    ...item,
    read: input.readIds.has(item.id),
  }))
}
