import { ActionSheetIOS, Alert, Linking, Platform } from "react-native"

/** Links a customer opens after booking: maps directions and a Google Calendar event. */

type DirectionsTarget = {
  latitude?: number
  longitude?: number
  /** Address / place name when coords are missing. */
  query: string
}

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

function destinationLabel(input: DirectionsTarget) {
  if (input.latitude != null && input.longitude != null) {
    return `${input.latitude},${input.longitude}`
  }
  return input.query.trim()
}

/** Google Maps directions URL (Android default / chooser option). */
export function directionsUrl(input: DirectionsTarget) {
  const destination = destinationLabel(input)
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

/** Native Apple Maps directions URL (required option for App Store Guideline 4). */
export function appleMapsDirectionsUrl(input: DirectionsTarget) {
  const destination = destinationLabel(input)
  return `http://maps.apple.com/?daddr=${encodeURIComponent(destination)}`
}

/**
 * Opens directions. On iOS, always offers Apple Maps (and Google Maps) so we
 * are not limited to a third-party maps app — App Store Guideline 4.
 */
export function openDirections(input: DirectionsTarget) {
  const destination = destinationLabel(input)
  if (!destination) return

  const apple = appleMapsDirectionsUrl(input)
  const google = directionsUrl(input)

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Open directions in",
        options: ["Cancel", "Apple Maps", "Google Maps"],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) void Linking.openURL(apple)
        if (buttonIndex === 2) void Linking.openURL(google)
      },
    )
    return
  }

  Alert.alert("Open directions in", undefined, [
    { text: "Cancel", style: "cancel" },
    { text: "Google Maps", onPress: () => void Linking.openURL(google) },
  ])
}
