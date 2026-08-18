import AsyncStorage from "@react-native-async-storage/async-storage"

import { apiFetch } from "@/lib/api"
import { getAccessToken, setAccessToken } from "@/lib/session"
import {
  getConsumerProfile as getCachedProfile,
  isValidEmail,
  patchConsumerProfileCache,
  setDisplayName,
  type ConsumerProfile,
} from "@/lib/user"

const PROFILE_KEY = "glammzo_consumer_profile"

async function cacheProfile(profile: ConsumerProfile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  if (profile.name.trim()) {
    await setDisplayName(profile.name)
  }
}

function mapProfile(raw: {
  name?: string
  email?: string
  phone?: string
  gender?: string
  dateOfBirth?: string
  address?: string
}): ConsumerProfile {
  return {
    name: raw.name?.trim() ?? "",
    email: raw.email?.trim() ?? "",
    phone: raw.phone?.trim() ?? "",
    gender: (raw.gender as ConsumerProfile["gender"]) || "",
    dateOfBirth: raw.dateOfBirth?.trim() ?? "",
    address: raw.address?.trim() ?? "",
  }
}

export async function fetchProfileFromApi(): Promise<ConsumerProfile> {
  const data = await apiFetch<{
    ok: boolean
    profile: {
      name: string
      email: string
      phone: string
      gender: string
      dateOfBirth: string
      address: string
    }
  }>("/api/mobile/profile")

  const profile = mapProfile(data.profile)
  await cacheProfile(profile)
  return profile
}

export async function patchProfileOnApi(profile: ConsumerProfile) {
  const data = await apiFetch<{
    ok: boolean
    profile: {
      name: string
      email: string
      phone: string
      gender: string
      dateOfBirth: string
      address: string
    }
    accessToken?: string
  }>("/api/mobile/profile", {
    method: "PATCH",
    body: {
      name: profile.name,
      email: profile.email,
      gender: profile.gender || "",
      dateOfBirth: profile.dateOfBirth,
      address: profile.address,
    },
  })

  if (data.accessToken) {
    await setAccessToken(data.accessToken)
  }

  const next = mapProfile(data.profile)
  await cacheProfile(next)
  return next
}

export async function loadProfilePreferApi(): Promise<ConsumerProfile> {
  try {
    return await fetchProfileFromApi()
  } catch {
    return getCachedProfile()
  }
}

/**
 * Persist an email collected during booking onto the logged-in consumer profile.
 * Never throws — booking success should not depend on this.
 */
export async function syncProfileEmailFromBooking(email: string): Promise<void> {
  const trimmed = email.trim()
  if (!isValidEmail(trimmed)) return

  const token = await getAccessToken()
  if (!token) {
    await patchConsumerProfileCache({ email: trimmed })
    return
  }

  try {
    const current = await loadProfilePreferApi()
    if (current.email.trim().toLowerCase() === trimmed.toLowerCase()) {
      return
    }
    await patchProfileOnApi({ ...current, email: trimmed })
  } catch {
    try {
      await patchConsumerProfileCache({ email: trimmed })
    } catch {
      // ignore — invoice email is already on the booking
    }
  }
}

export async function deleteAccountOnApi() {
  await apiFetch<{ ok: boolean; deleted: boolean }>("/api/mobile/account", {
    method: "DELETE",
    body: { confirm: "DELETE" },
  })
}
