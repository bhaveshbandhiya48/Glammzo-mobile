import { useRouter, type Href } from "expo-router"
import { useEffect, useRef } from "react"
import * as Notifications from "expo-notifications"
import { AppState } from "react-native"

import { hrefFromNotificationData, registerPushTokenWithServer } from "@/lib/push"
import { getAccessToken } from "@/lib/session"

/**
 * Registers the device for remote push when signed in, and opens deep links on tap.
 */
export function usePushRegistration() {
  const router = useRouter()
  const responseListener = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    let cancelled = false

    async function registerIfSignedIn() {
      const token = await getAccessToken()
      if (!token || cancelled) return
      await registerPushTokenWithServer()
    }

    void registerIfSignedIn()

    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void registerIfSignedIn()
    })

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const href = hrefFromNotificationData(response.notification.request.content.data)
        if (href) {
          router.push(href as Href)
        }
      })

    // Cold start: user opened app from a notification
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response || cancelled) return
      const href = hrefFromNotificationData(response.notification.request.content.data)
      if (href) router.push(href as Href)
    })

    return () => {
      cancelled = true
      appSub.remove()
      responseListener.current?.remove()
    }
  }, [router])
}
