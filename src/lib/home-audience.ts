import AsyncStorage from "@react-native-async-storage/async-storage"
import { useEffect, useState } from "react"

import type { HomeAudience } from "@/lib/service-tiles"
import { getConsumerProfile } from "@/lib/user"

const STORAGE_KEY = "glammzo_home_audience_v1"

let memo: HomeAudience | null = null
/** Every mounted switch and list, so a change on Home also narrows Explore lists right away. */
const listeners = new Set<(value: HomeAudience) => void>()

export function parseHomeAudience(value: unknown): HomeAudience | null {
  return value === "women" || value === "men" ? value : null
}

/** Saved pick, else the profile's gender (male → Men), else Women. */
async function loadHomeAudience(): Promise<HomeAudience> {
  try {
    const saved = parseHomeAudience(await AsyncStorage.getItem(STORAGE_KEY))
    if (saved) return saved
  } catch {
    // Fall through to the profile default.
  }
  try {
    const profile = await getConsumerProfile()
    const gender = profile.gender.trim().toLowerCase()
    if (gender === "male") return "men"
  } catch {
    // Default below.
  }
  return "women"
}

/** Home Women/Men switch, persisted on this device. */
export function useHomeAudience(): [HomeAudience, (next: HomeAudience) => void] {
  const [audience, setAudience] = useState<HomeAudience>(memo ?? "women")

  useEffect(() => {
    listeners.add(setAudience)
    return () => {
      listeners.delete(setAudience)
    }
  }, [])

  useEffect(() => {
    if (memo) return
    let cancelled = false
    void loadHomeAudience().then((value) => {
      memo = value
      if (!cancelled) listeners.forEach((listener) => listener(value))
    })
    return () => {
      cancelled = true
    }
  }, [])

  function update(next: HomeAudience) {
    memo = next
    listeners.forEach((listener) => listener(next))
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined)
  }

  return [audience, update]
}
