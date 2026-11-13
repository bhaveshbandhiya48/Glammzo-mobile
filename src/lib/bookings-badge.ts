import { useSyncExternalStore } from "react"

import type { Booking } from "@/data/types"

/**
 * Last bookings list the app loaded, shared with the tab bar's Bookings badge.
 * `fetchBookings` publishes here, so the badge never makes its own network call.
 */
let lastBookings: Booking[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function publishBookings(bookings: Booking[]) {
  lastBookings = bookings
  emit()
}

/** Signed out: forget the list so the badge disappears. */
export function clearPublishedBookings() {
  if (lastBookings.length === 0) return
  lastBookings = []
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const CONFIRMED = new Set(["confirmed", "upcoming"])

function bookingStartMs(booking: Booking) {
  return booking.startsAt ? Date.parse(booking.startsAt) : Date.parse(`${booking.date}T23:59:00`)
}

/**
 * A visit still ahead of the customer: confirmed, or waiting for its advance payment
 * while the hold is still open. Same rule as the Home next-booking card.
 */
export function isUpcomingVisit(booking: Booking, now = Date.now()) {
  const deadline = booking.paymentDeadline ? Date.parse(booking.paymentDeadline) : Number.NaN
  const awaitingPayment = booking.status === "pending" && Number.isFinite(deadline) && deadline > now
  if (!CONFIRMED.has(booking.status) && !awaitingPayment) return false
  const at = bookingStartMs(booking)
  return Number.isFinite(at) && at >= now
}

/** Upcoming confirmed plus payment-pending bookings, from the last loaded list. */
export function useUpcomingBookingsCount() {
  const bookings = useSyncExternalStore(subscribe, () => lastBookings, () => lastBookings)
  const now = Date.now()
  let count = 0
  for (const booking of bookings) if (isUpcomingVisit(booking, now)) count += 1
  return count
}
