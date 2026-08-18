import { useEffect, useRef } from "react"
import { AppState } from "react-native"

import {
  bootstrapLaunchPermissions,
  refreshLaunchLocation,
} from "@/lib/launch-permissions"

/**
 * Ask location + notification permissions once per app session after launch.
 * Refresh GPS when the app returns to the foreground (unless the user picked
 * a browse location this session).
 */
export function useLaunchPermissions(onReady?: () => void) {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    void bootstrapLaunchPermissions().finally(() => {
      onReady?.()
    })
  }, [onReady])

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return
      void refreshLaunchLocation()
    })
    return () => sub.remove()
  }, [])
}
