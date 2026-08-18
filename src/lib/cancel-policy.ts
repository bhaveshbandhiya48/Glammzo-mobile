/** Fallback when a salon has no active cancellation policy. */
export const CUSTOMER_CANCEL_MIN_NOTICE_HOURS = 2

/**
 * Customer may cancel only when appointment start is more than
 * `minNoticeHours` away (salon policy, or platform default).
 */
export function canCancelWithNotice(
  startsAtIso: string | null | undefined,
  minNoticeHours: number = CUSTOMER_CANCEL_MIN_NOTICE_HOURS,
  now = new Date(),
): { allowed: true } | { allowed: false; reason: "missing_start" | "too_soon" } {
  if (!startsAtIso) {
    return { allowed: false, reason: "missing_start" }
  }

  const startsAt = new Date(startsAtIso)
  if (Number.isNaN(startsAt.getTime())) {
    return { allowed: false, reason: "missing_start" }
  }

  const msUntilStart = startsAt.getTime() - now.getTime()
  const minMs = minNoticeHours * 60 * 60 * 1000

  if (msUntilStart < minMs) {
    return { allowed: false, reason: "too_soon" }
  }

  return { allowed: true }
}

export function getCancelBlockedReason(
  startsAtIso?: string | null,
  noticeHours: number = CUSTOMER_CANCEL_MIN_NOTICE_HOURS,
) {
  const result = canCancelWithNotice(startsAtIso, noticeHours)
  if (result.allowed) return null
  if (result.reason === "too_soon") {
    if (noticeHours <= 0) {
      return "This booking can no longer be cancelled online. Please contact the salon if you need help."
    }
    return `Cancellations must be made at least ${noticeHours} hours before your appointment. Please contact the salon if you need help.`
  }
  return "This booking can no longer be cancelled online."
}
