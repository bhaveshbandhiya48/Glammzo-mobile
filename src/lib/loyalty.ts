import { mockBookings } from "@/data/mocks/bookings"

/** Matches Glammzo-web wallet-constants */
export const LOYALTY_VISITS_PER_FREE = 10
export const LOYALTY_DISCOUNT_CAP_RUPEES = 999

export type LoyaltySummary = {
  /** Completed appointments only (not cancelled / pending / confirmed). */
  completedVisits: number
  /** Credits earned every 10 completed visits. */
  freeServiceCredits: number
  /** Progress in the current 10-visit cycle (0–9, or 0 after unlock). */
  stampsTowardNextFree: number
  visitsLeft: number
}

/**
 * Loyalty progress counts only `completed` bookings.
 * Cancelled / declined / expired / pending do not count.
 */
export const EMPTY_LOYALTY_SUMMARY: LoyaltySummary = {
  completedVisits: 0,
  freeServiceCredits: 0,
  stampsTowardNextFree: 0,
  visitsLeft: LOYALTY_VISITS_PER_FREE,
}

export function getLoyaltySummary(): LoyaltySummary {
  const completedVisits = mockBookings.filter((booking) => booking.status === "completed")
    .length
  const freeServiceCredits = Math.floor(completedVisits / LOYALTY_VISITS_PER_FREE)
  const stampsTowardNextFree = completedVisits % LOYALTY_VISITS_PER_FREE
  const visitsLeft = Math.max(0, LOYALTY_VISITS_PER_FREE - stampsTowardNextFree)

  return {
    completedVisits,
    freeServiceCredits,
    stampsTowardNextFree,
    visitsLeft,
  }
}

export function canApplyLoyalty(summary: LoyaltySummary = getLoyaltySummary()) {
  return summary.freeServiceCredits > 0
}
