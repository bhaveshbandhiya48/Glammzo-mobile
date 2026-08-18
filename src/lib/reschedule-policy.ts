/** Minimum notice before appointment start for customer self-reschedule. */
export const CUSTOMER_RESCHEDULE_MIN_NOTICE_HOURS = 4

/**
 * Customer may reschedule only when appointment start is more than
 * CUSTOMER_RESCHEDULE_MIN_NOTICE_HOURS away.
 */
export function canRescheduleWithNotice(
  startsAtIso: string | null | undefined,
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
  const minMs = CUSTOMER_RESCHEDULE_MIN_NOTICE_HOURS * 60 * 60 * 1000

  if (msUntilStart < minMs) {
    return { allowed: false, reason: "too_soon" }
  }

  return { allowed: true }
}

export function getRescheduleBlockedReason(startsAtIso?: string | null) {
  const result = canRescheduleWithNotice(startsAtIso)
  if (result.allowed) return null
  if (result.reason === "too_soon") {
    return `Reschedules must be made at least ${CUSTOMER_RESCHEDULE_MIN_NOTICE_HOURS} hours before your appointment. Please contact the salon if you need help.`
  }
  return "This booking can no longer be rescheduled online."
}
