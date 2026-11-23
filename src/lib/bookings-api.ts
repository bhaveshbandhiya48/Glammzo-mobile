import type { AppOfferSelection } from "@/lib/app-offers-api"
import type { Booking } from "@/data/types"
import { ApiError, apiFetch, networkFailure, TIMED_OUT_MESSAGE } from "@/lib/api"
import { API_URL } from "@/lib/config"
import { publishBookings } from "@/lib/bookings-badge"
import { getAccessToken } from "@/lib/session"

export type CreateBookingInput = {
  salonId: string
  serviceIds: string[]
  date: string
  time: string
  notes?: string
  customerName: string
  customerEmail: string
  customerPhone: string
  preferredStaffId?: string
  packageId?: string
  promoCode?: string
  /** Glammzo offer: picked, typed, or let the server apply the best automatic one. */
  appOffer?: AppOfferSelection
  useWallet?: boolean
  useFreeService?: boolean
  marketingOptIn?: boolean
  serviceQuantities?: Record<string, number>
  servicePriceOptionIds?: Record<string, string>
}

/** The advance wasn't paid in time: flagged by the server, or the hold just ran out on this phone. */
export function withPaymentStatus(booking: Booking, now = Date.now()): Booking {
  const holdEnded =
    booking.status === "pending" && booking.paymentDeadline != null && Date.parse(booking.paymentDeadline) <= now
  return booking.paymentFailed || holdEnded
    ? { ...booking, status: "payment_failed", paymentDeadline: undefined }
    : booking
}

export async function fetchBookings(): Promise<Booking[]> {
  const data = await apiFetch<{ ok: boolean; bookings: Booking[] }>(
    "/api/mobile/bookings",
  )
  // Latest activity first: whatever was just booked, changed or cancelled is on top.
  const changedAt = (booking: Booking) => Date.parse(booking.updatedAt ?? booking.createdAt) || 0
  const bookings = (data.bookings ?? [])
    .map((booking) => withPaymentStatus(booking))
    .sort((a, b) => changedAt(b) - changedAt(a))
  // Keeps the tab bar's Bookings badge current without a fetch of its own.
  publishBookings(bookings)
  return bookings
}

export async function fetchBookingById(id: string): Promise<Booking | undefined> {
  const data = await apiFetch<{ ok: boolean; booking: Booking }>(
    `/api/mobile/bookings/${encodeURIComponent(id)}`,
  )
  return data.booking ? withPaymentStatus(data.booking) : undefined
}

export async function createBooking(input: CreateBookingInput) {
  return apiFetch<{ ok: boolean; booking: Booking }>("/api/mobile/bookings", {
    method: "POST",
    body: input,
  })
}

export async function cancelBooking(
  id: string,
  options?: { reasonId?: string; details?: string },
) {
  return apiFetch<{ ok: boolean; cancelled: boolean }>(
    `/api/mobile/bookings/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
      body: {
        reasonId: options?.reasonId ?? "change_of_plans",
        details: options?.details,
      },
    },
  )
}

export async function rescheduleBooking(
  id: string,
  input: { date: string; time: string },
) {
  return apiFetch<{ ok: boolean; rescheduled: boolean }>(
    `/api/mobile/bookings/${encodeURIComponent(id)}/reschedule`,
    {
      method: "POST",
      body: input,
    },
  )
}

export type ArtistRescheduleInfo = {
  canRequest: boolean
  reason: string | null
  code: string | null
  noticeHours: number
  timezone: string
  startsAt: string
  durationMinutes: number
  pending: { requestedStartsAt: string; previousStartsAt: string; note?: string | null } | null
}

/** Solo artist booking: can the client ask for a new time, and any open request. */
export async function fetchArtistRescheduleInfo(id: string) {
  return apiFetch<ArtistRescheduleInfo>(`/api/mobile/bookings/${encodeURIComponent(id)}/artist-reschedule`)
}

/** Free start times (ISO) that day for this artist booking. */
export async function fetchArtistRescheduleSlots(id: string, date: string) {
  return apiFetch<{ slots?: string[]; message?: string }>(
    `/api/mobile/bookings/${encodeURIComponent(id)}/artist-reschedule?date=${encodeURIComponent(date)}`,
  )
}

/** Ask the artist to move the booking. It stays as it is until they approve. */
export async function requestArtistReschedule(id: string, input: { startAt: string; note?: string }) {
  return apiFetch<{ ok: boolean }>(`/api/mobile/bookings/${encodeURIComponent(id)}/artist-reschedule`, {
    method: "POST",
    body: input,
  })
}

/** Take back a request the artist hasn't answered. */
export async function withdrawArtistReschedule(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/mobile/bookings/${encodeURIComponent(id)}/artist-reschedule`, {
    method: "DELETE",
  })
}

export type BookingInvoicePdf = {
  bytes: Uint8Array
  fileName: string
}

function invoiceFileNameFromHeader(header: string | null) {
  const match = header?.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i)
  const raw = match?.[1]?.trim()
  if (!raw) return "invoice.pdf"
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export async function downloadBookingInvoicePdf(
  id: string,
): Promise<BookingInvoicePdf> {
  const headers: Record<string, string> = {
    Accept: "application/pdf",
  }
  const token = await getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  let response: Response
  try {
    response = await fetch(
      `${API_URL}/api/mobile/bookings/${encodeURIComponent(id)}/invoice`,
      { headers, signal: controller.signal },
    )
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || controller.signal.aborted)
    ) {
      throw new ApiError(408, TIMED_OUT_MESSAGE)
    }
    throw await networkFailure(error)
  } finally {
    clearTimeout(timeoutId)
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (!response.ok || contentType.includes("json")) {
    let message = `Request failed (${response.status})`
    try {
      const data = (await response.json()) as { error?: string }
      if (typeof data.error === "string" && data.error.trim()) {
        message = data.error
      }
    } catch {
      // keep fallback message
    }
    throw new ApiError(response.status || 500, message)
  }

  const fileName =
    response.headers.get("x-invoice-file-name")?.trim() ||
    invoiceFileNameFromHeader(response.headers.get("content-disposition"))

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    fileName: fileName || "invoice.pdf",
  }
}
