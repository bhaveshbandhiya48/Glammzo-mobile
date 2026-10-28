import { apiFetch } from "@/lib/api"
import { CRM_URL } from "@/lib/config"

export async function submitSalonReview(input: {
  appointmentId: string
  rating: number
  reviewType: string
  comment: string
  includeStaffReview?: boolean
}) {
  return apiFetch<{
    ok: boolean
    submitted?: boolean
    alreadyReviewed?: boolean
  }>("/api/mobile/reviews", {
    method: "POST",
    body: input,
  })
}

/** Solo-artist review via CRM public booking token. */
export async function submitArtistReview(input: {
  publicToken: string
  rating: number
  reviewType: string
  comment: string
}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(
      `${CRM_URL}/api/public/bookings/${encodeURIComponent(input.publicToken)}/review`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: input.rating,
          reviewType: input.reviewType,
          comment: input.comment,
        }),
        signal: controller.signal,
      },
    )
    const data = (await response.json().catch(() => ({}))) as {
      submitted?: boolean
      alreadyReviewed?: boolean
      error?: string
    }
    if (!response.ok) {
      throw new Error(data.error || `Could not submit review (${response.status})`)
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}
