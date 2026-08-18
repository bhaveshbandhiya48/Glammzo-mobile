import { apiFetch } from "@/lib/api"
import type { Booking } from "@/data/types"

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
