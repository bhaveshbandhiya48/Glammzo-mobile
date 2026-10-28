import type { Booking } from "@/data/types"
import { ApiError, apiFetch } from "@/lib/api"
import { API_URL } from "@/lib/config"
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
  useWallet?: boolean
  useFreeService?: boolean
  usePackageSessions?: boolean
  marketingOptIn?: boolean
  serviceQuantities?: Record<string, number>
  servicePriceOptionIds?: Record<string, string>
}

export async function fetchBookings(): Promise<Booking[]> {
  const data = await apiFetch<{ ok: boolean; bookings: Booking[] }>(
    "/api/mobile/bookings",
  )
  return data.bookings ?? []
}

export async function fetchBookingById(id: string): Promise<Booking | undefined> {
  const data = await apiFetch<{ ok: boolean; booking: Booking }>(
    `/api/mobile/bookings/${encodeURIComponent(id)}`,
  )
  return data.booking
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
      throw new ApiError(408, "Request timed out")
    }
    throw error
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
