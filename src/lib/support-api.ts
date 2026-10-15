import { ApiError, apiFetch } from "@/lib/api"

export type SupportTicketField =
  | "name"
  | "email"
  | "phone"
  | "salonName"
  | "bookingReference"
  | "message"

export type SupportTicketInput = {
  name: string
  email: string
  phone?: string
  salonName?: string
  bookingReference: string
  message: string
}

export type SupportTicketFieldErrors = Partial<Record<SupportTicketField, string>>

export function supportFieldErrorsFromApi(error: unknown): SupportTicketFieldErrors {
  if (!(error instanceof ApiError)) return {}
  const raw = error.extras.fieldErrors
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  return raw as SupportTicketFieldErrors
}

export async function submitSupportTicket(input: SupportTicketInput) {
  return apiFetch<{ ok: boolean; message: string }>("/api/mobile/support/ticket", {
    method: "POST",
    body: {
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim() || undefined,
      salonName: input.salonName?.trim() || undefined,
      bookingReference: input.bookingReference.trim(),
      message: input.message.trim(),
    },
  })
}
