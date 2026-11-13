import { useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"

import type { Booking } from "@/data/types"
import { fetchBookings } from "@/lib/bookings-api"
import { isUpcomingVisit } from "@/lib/bookings-badge"
import { getAccessToken } from "@/lib/session"

/** The customer's bookings for Home (empty when signed out or on error). Refetches on focus. */
export function useHomeBookings(refreshKey = 0) {
  const [bookings, setBookings] = useState<Booking[]>([])

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        if (!(await getAccessToken())) {
          if (!cancelled) setBookings([])
          return
        }
        try {
          const loaded = await fetchBookings()
          if (!cancelled) setBookings(loaded)
        } catch {
          // Home must never fail because of bookings.
        }
      })()
      return () => {
        cancelled = true
      }
    }, [refreshKey]),
  )

  return [bookings, setBookings] as const
}

function bookingStartMs(booking: Booking) {
  return booking.startsAt
    ? Date.parse(booking.startsAt)
    : Date.parse(`${booking.date}T23:59:00`)
}

/**
 * Soonest upcoming visit to show on Home: a confirmed one, or one still waiting
 * for its advance payment (so the customer doesn't lose the held slot).
 */
export function pickNextHomeBooking(bookings: Booking[], now = Date.now()): Booking | null {
  const upcoming = bookings
    .filter((b) => isUpcomingVisit(b, now))
    .map((b) => ({ b, at: bookingStartMs(b) }))
    .sort((a, b) => a.at - b.at)
  return upcoming[0]?.b ?? null
}

/** Past completed visits, newest first, one per salon / artist, max `limit`. */
export function pickBookAgain(bookings: Booking[], limit = 5): Booking[] {
  const seen = new Set<string>()
  const out: Booking[] = []
  const completed = bookings
    .filter((b) => b.status === "completed")
    .sort((a, b) => (bookingStartMs(b) || 0) - (bookingStartMs(a) || 0))
  for (const booking of completed) {
    const key =
      booking.kind === "artist" ? `a:${booking.artistSlug ?? booking.salonId}` : `s:${booking.salonId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(booking)
    if (out.length >= limit) break
  }
  return out
}
