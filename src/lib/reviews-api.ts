import { apiFetch } from "@/lib/api"

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
    body: JSON.stringify(input),
  })
}
