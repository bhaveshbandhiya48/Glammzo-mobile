import { apiFetch } from "@/lib/api"

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
          imageUrl:
            typeof member.imageUrl === "string" && member.imageUrl.trim()
              ? member.imageUrl.trim()
              : null,
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
  }
}
