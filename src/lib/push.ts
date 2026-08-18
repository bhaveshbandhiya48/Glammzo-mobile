import Constants from "expo-constants"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"

import { apiFetch } from "@/lib/api"
import { getAccessToken } from "@/lib/session"

const ANDROID_CHANNEL_ID = "glammzo-default"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

function resolveProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    undefined
  )
}

export async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Glammzo",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#F95C48",
  })
}

/**
 * Ask permission + return Expo push token.
 * Returns null when denied, on web, or when Expo Go Android cannot use remote push.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null

  await ensureAndroidChannel()

  if (!Device.isDevice) {
    // Simulators may still work on newer Xcode; try anyway on iOS.
    if (Platform.OS !== "ios") return null
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== "granted") return null

  const projectId = resolveProjectId()
  if (!projectId) {
    console.warn("[push] Missing EAS projectId in app.json extra.eas.projectId")
    return null
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId })
    return token.data
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(
      "[push] getExpoPushTokenAsync failed:",
      message,
      Platform.OS === "android"
        ? "(Android needs google-services.json + FCM V1 credentials on EAS — see .env.example)"
        : "",
    )
    return null
  }
}

export async function registerPushTokenWithServer(): Promise<boolean> {
  const accessToken = await getAccessToken()
  if (!accessToken) return false

  const expoPushToken = await getExpoPushToken()
  if (!expoPushToken) return false

  try {
    await apiFetch("/api/mobile/push/register", {
      method: "POST",
      body: {
        expoPushToken,
        platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown",
        deviceId: Device.modelName ?? undefined,
      },
    })
    return true
  } catch (error) {
    console.warn("[push] register failed:", error)
    return false
  }
}

export async function unregisterPushTokenFromServer() {
  const accessToken = await getAccessToken()
  if (!accessToken) return

  const expoPushToken = await getExpoPushToken().catch(() => null)
  try {
    await apiFetch("/api/mobile/push/register", {
      method: "DELETE",
      body: expoPushToken ? { expoPushToken } : {},
    })
  } catch {
    // best-effort
  }
}

export function hrefFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const href = (data as { href?: unknown }).href
  return typeof href === "string" && href.startsWith("/") ? href : null
}

/** Schedule local reminder ~1h before confirmed/upcoming bookings (works when app is closed). */
export async function syncLocalBookingReminders(
  bookings: {
    id: string
    salonName: string
    date: string
    time: string
    status: string
  }[],
) {
  if (Platform.OS === "web") return

  const { status } = await Notifications.getPermissionsAsync()
  if (status !== "granted") return

  // Clear previous Glammzo reminders
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.kind === "booking_reminder")
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  )

  const now = Date.now()
  for (const booking of bookings) {
    if (booking.status !== "confirmed" && booking.status !== "upcoming") continue
    const start = parseBookingStartMs(booking.date, booking.time)
    if (!start) continue
    const fireAt = start - 60 * 60 * 1000
    if (fireAt <= now + 30_000) continue

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Reminder · 1 hour to go",
        body: `Your visit at ${booking.salonName} starts soon.`,
        data: {
          kind: "booking_reminder",
          bookingId: booking.id,
          href: "/(tabs)/bookings",
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(fireAt),
        channelId: ANDROID_CHANNEL_ID,
      },
    })
  }
}

function parseBookingStartMs(date: string, time: string): number | null {
  const d = date?.trim()
  const t = time?.trim()
  if (!d) return null

  const twentyFour = t?.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFour) {
    const ms = new Date(
      `${d}T${twentyFour[1]!.padStart(2, "0")}:${twentyFour[2]}:00`,
    ).getTime()
    return Number.isNaN(ms) ? null : ms
  }

  const twelve = t?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (twelve) {
    let hours = Number(twelve[1])
    const mins = Number(twelve[2])
    const period = twelve[3]!.toUpperCase()
    if (period === "PM" && hours < 12) hours += 12
    if (period === "AM" && hours === 12) hours = 0
    const ms = new Date(
      `${d}T${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`,
    ).getTime()
    return Number.isNaN(ms) ? null : ms
  }

  return null
}
