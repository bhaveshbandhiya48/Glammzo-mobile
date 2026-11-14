import { ApiError, apiFetch } from "@/lib/api"

/** Get quotes (customer requests that artists reply to with a price). Bearer session, like bookings. */

export type LeadStatus = "open" | "closed" | "expired"

export type LeadRequest = {
  id: string
  category: string
  occasion: string | null
  eventDate: string
  people: number
  city: string
  area: string | null
  budgetRupees: number | null
  details: string | null
  status: LeadStatus
  createdAt: string
  expiresAt: string
}

export type LeadListItem = LeadRequest & {
  quoteCount: number
  artistAvatars: string[]
}

export type LeadQuote = {
  responseId: string
  artistId: string
  artistSlug: string
  displayName: string
  profilePhotoUrl: string | null
  level: string
  levelLabel: string
  rating: number | null
  reviewCount: number
  distanceKm: number | null
  area: string | null
  city: string | null
  quoteRupees: number | null
  message: string
  status: "sent" | "accepted" | "declined"
  createdAt: string
}

export type CreateLeadInput = {
  city: string
  area?: string | null
  category: string
  occasion?: string | null
  eventDate: string
  people: number
  budgetRupees?: number | null
  details?: string | null
}

export const GET_QUOTES_UNAVAILABLE = "Get quotes isn't available right now"

/** Server text as-is; 503 (feature off / CRM down) reads the same everywhere. */
export function leadErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 503) return GET_QUOTES_UNAVAILABLE
    return error.message || fallback
  }
  return error instanceof Error && error.message ? error.message : fallback
}

export async function createLead(input: CreateLeadInput) {
  const data = await apiFetch<{ ok?: boolean; id: string }>("/api/mobile/leads", {
    method: "POST",
    body: input,
  })
  return { id: data.id }
}

export async function fetchLeads(): Promise<LeadListItem[]> {
  const data = await apiFetch<{ ok?: boolean; requests: LeadListItem[] }>("/api/mobile/leads")
  return data.requests ?? []
}

export async function fetchLead(id: string): Promise<{ request: LeadRequest; quotes: LeadQuote[] }> {
  const data = await apiFetch<{ ok?: boolean; request: LeadRequest; quotes: LeadQuote[] }>(
    `/api/mobile/leads/${encodeURIComponent(id)}`,
  )
  return { request: data.request, quotes: data.quotes ?? [] }
}

export async function closeLead(id: string) {
  return apiFetch<{ ok?: boolean; status: LeadStatus }>(
    `/api/mobile/leads/${encodeURIComponent(id)}/close`,
    { method: "POST", body: {} },
  )
}

export async function acceptLeadQuote(id: string, responseId: string) {
  return apiFetch<{ ok?: boolean; artistSlug: string; responseId: string; quoteRupees: number | null }>(
    `/api/mobile/leads/${encodeURIComponent(id)}/accept`,
    { method: "POST", body: { responseId } },
  )
}
