/** Links a customer opens after booking: Google Maps directions and a Google Calendar event. */

/** "11:00 AM", "10:00 am" or "17:30" on an ISO date → local Date, or null. */
export function visitStart(date: string, time: string, startsAt?: string | null): Date | null {
  if (startsAt) {
    const at = new Date(startsAt)
    if (!Number.isNaN(at.getTime())) return at
  }
  const m = time.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i)
  if (!date || !m) return null
  let hour = Number(m[1])
  const suffix = m[3]?.toLowerCase()
  if (suffix === "pm" && hour < 12) hour += 12
  if (suffix === "am" && hour === 12) hour = 0
  const at = new Date(`${date}T${String(hour).padStart(2, "0")}:${m[2]}:00`)
  return Number.isNaN(at.getTime()) ? null : at
}

function calendarStamp(at: Date) {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

export function googleCalendarUrl(input: {
  title: string
  start: Date
  durationMin: number
  location?: string
  details?: string
}) {
  const end = new Date(input.start.getTime() + Math.max(15, input.durationMin || 60) * 60_000)
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${calendarStamp(input.start)}/${calendarStamp(end)}`,
  })
  if (input.location) params.set("location", input.location)
  if (input.details) params.set("details", input.details)
  return `https://calendar.google.com/calendar/render?${params}`
}

export function directionsUrl(input: { latitude?: number; longitude?: number; query: string }) {
  const destination =
    input.latitude != null && input.longitude != null
      ? `${input.latitude},${input.longitude}`
      : input.query
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}
