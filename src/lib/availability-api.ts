import { apiFetch } from "@/lib/api"
import { staffPhotoUrl } from "@/lib/staff-photo"

export type AvailabilitySlot = {
  value: string
  label: string
}

export type AvailabilityDay = {
  date: string
  availableCount: number
  closed: boolean
}

export type AvailabilityStaff = {
  id: string
  name: string
  role: string
  imageUrl?: string | null
}

export type AvailabilityResult = {
  date: string
  closed: boolean
  closedMessage: string | null
  days: AvailabilityDay[]
  slots: AvailabilitySlot[]
  staff: AvailabilityStaff[]
  /** Pro salons asking for an advance on online bookings. */
  advance: SalonAdvanceConfig | null
}

export type SalonAdvanceConfig = { type: "percent" | "fixed"; value: number; policy: "flexible" | "moderate" | "strict" }

/** Whole rupees due now, never more than the bill. Mirrors the server. */
export function computeSalonAdvance(config: SalonAdvanceConfig | null, totalRupees: number) {
  if (!config || totalRupees <= 0) return 0
  const raw = config.type === "percent" ? (totalRupees * config.value) / 100 : config.value
  return Math.min(totalRupees, Math.round(raw))
}

/** Refund rules for a salon's advance, in plain words. Mirrors the server. */
export function salonAdvancePolicyLines(policy: SalonAdvanceConfig["policy"]): string[] {
  const head: Record<SalonAdvanceConfig["policy"], string[]> = {
    flexible: ["Full refund if you cancel 1 day or more before."],
    moderate: ["Full refund if you cancel 2 days or more before.", "50% refund if you cancel 1 day or more before."],
    strict: ["Full refund if you cancel 7 days or more before.", "50% refund if you cancel 2 days or more before."],
  }
  return [
    ...head[policy],
    `No refund after that, or if you don't show up.`,
    "If the salon declines or cancels, you get it all back.",
  ]
}

export async function fetchAvailability(params: {
  salonId: string
  date?: string
  serviceIds?: string[]
  packageId?: string | null
  staffId?: string | null
}): Promise<AvailabilityResult> {
  const query = new URLSearchParams()
  query.set("salonId", params.salonId)
  if (params.date) query.set("date", params.date)
  if (params.serviceIds?.length) {
    query.set("serviceIds", params.serviceIds.join(","))
  }
  if (params.packageId) query.set("packageId", params.packageId)
  if (params.staffId) query.set("staffId", params.staffId)

  const data = await apiFetch<{
    ok: boolean
    date: string
    closed: boolean
    closedMessage: string | null
    days: AvailabilityDay[]
    slots: AvailabilitySlot[]
    staff?: AvailabilityStaff[]
    advance?: SalonAdvanceConfig | null
  }>(`/api/mobile/availability?${query.toString()}`)

  const staff = Array.isArray(data.staff)
    ? data.staff.flatMap((member) => {
        const id = typeof member.id === "string" ? member.id.trim() : ""
        const name = typeof member.name === "string" ? member.name.trim() : ""
        if (!id || !name) return []
        const next: AvailabilityStaff = {
          id,
          name,
          role:
            typeof member.role === "string" && member.role.trim()
              ? member.role.trim()
              : "Specialist",
          imageUrl: staffPhotoUrl(typeof member.imageUrl === "string" ? member.imageUrl : null),
        }
        return [next]
      })
    : []

  return {
    date: data.date,
    closed: Boolean(data.closed),
    closedMessage: data.closedMessage ?? null,
    days: Array.isArray(data.days) ? data.days : [],
    slots: Array.isArray(data.slots) ? data.slots : [],
    staff,
    advance: data.advance && Number(data.advance.value) > 0 ? data.advance : null,
  }
}
