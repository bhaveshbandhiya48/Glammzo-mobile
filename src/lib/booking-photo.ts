import { salonProfileImageUrl } from "@/data/mocks/salons"
import type { Booking } from "@/data/types"
import { resolveSalonById } from "@/lib/salons-api"

/**
 * Salon or artist photo for a booking: the one the bookings API sends, else (salons only)
 * the salon's photo from the cached catalog. Empty when neither is known.
 */
export function bookingPhotoUrl(booking: Pick<Booking, "salonId" | "kind" | "salonImageUrl">): string {
  const fromApi = booking.salonImageUrl?.trim()
  if (fromApi) return fromApi
  if (booking.kind === "artist") return ""
  const salon = resolveSalonById(booking.salonId)
  return salon ? salonProfileImageUrl(salon) : ""
}
