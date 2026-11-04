import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"

import { clearAccessToken, getAccessToken } from "@/lib/session"

const DISPLAY_NAME_KEY = "glammzo_display_name"
const LOCATION_KEY = "glammzo_location_label"
const LOCATION_DETAILS_KEY = "glammzo_location_details"
const PROFILE_KEY = "glammzo_consumer_profile"

export type SavedLocation = {
  label: string
  placeId?: string
  latitude?: number
  longitude?: number
  city?: string
  area?: string
  state?: string
  formattedAddress?: string
}

/** Fallback when location permission is denied or GPS fails. */
export const DEFAULT_SAVED_LOCATION: SavedLocation = {
  label: "Indiranagar, Bengaluru",
  area: "Indiranagar",
  city: "Bengaluru",
  state: "Karnataka",
  latitude: 12.9784,
  longitude: 77.6408,
  formattedAddress: "Indiranagar, Bengaluru, Karnataka",
}

export const CONSUMER_GENDER_OPTIONS = ["female", "male"] as const

export type ConsumerGender = (typeof CONSUMER_GENDER_OPTIONS)[number]

export const GENDER_LABELS: Record<ConsumerGender, string> = {
  female: "Female",
  male: "Male",
}

/** Labels for current + legacy stored values (locked after first save). */
const GENDER_LABEL_LOOKUP: Record<string, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non Binary",
  prefer_not_to_say: "Prefer Not To Say",
  other: "Other",
}

export function genderLabel(value: string): string {
  const key = value.trim().toLowerCase()
  if (!key) return ""
  return (
    GENDER_LABEL_LOOKUP[key] ??
    key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

export function isSelectableGender(value: string): value is ConsumerGender {
  return CONSUMER_GENDER_OPTIONS.includes(value as ConsumerGender)
}

export type ConsumerProfile = {
  name: string
  email: string
  phone: string
  /** "" when unset; male/female when selectable; may be a legacy value once locked. */
  gender: string
  dateOfBirth: string
  address: string
}

const emptyProfile: ConsumerProfile = {
  name: "",
  email: "",
  phone: "",
  gender: "",
  dateOfBirth: "",
  address: "",
}

/** Last greeting we confirmed (session-aware). Used so Home can paint instantly. */
let greetingCache: string | null = null

export function peekCachedGreeting(): string | null {
  return greetingCache
}

export async function getDisplayName(): Promise<string> {
  const profile = await getConsumerProfile()
  if (profile.name.trim()) return profile.name.trim()
  try {
    const name = await SecureStore.getItemAsync(DISPLAY_NAME_KEY)
    const trimmed = name?.trim()
    if (trimmed) return trimmed
  } catch {
    // SecureStore browser stub / unavailable
  }
  try {
    const name = await AsyncStorage.getItem(DISPLAY_NAME_KEY)
    const trimmed = name?.trim()
    if (trimmed) return trimmed
  } catch {
    // ignore
  }
  return "Guest"
}

/** Home greeting: never show a cached name without a session token. */
export async function getSignedInDisplayName(): Promise<string> {
  try {
    const token = await getAccessToken()
    if (!token) {
      greetingCache = "Guest"
      return "Guest"
    }
    const name = await getDisplayName()
    greetingCache = name
    return name
  } catch {
    return greetingCache ?? "Guest"
  }
}

export async function hydrateGreetingCache(): Promise<string> {
  return getSignedInDisplayName()
}

export async function setDisplayName(name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) {
    greetingCache = "Guest"
    try {
      await SecureStore.deleteItemAsync(DISPLAY_NAME_KEY)
    } catch {
      await AsyncStorage.removeItem(DISPLAY_NAME_KEY)
    }
    return
  }
  greetingCache = trimmed
  try {
    await SecureStore.setItemAsync(DISPLAY_NAME_KEY, trimmed)
  } catch {
    await AsyncStorage.setItem(DISPLAY_NAME_KEY, trimmed)
  }
}

export async function clearDisplayName(): Promise<void> {
  greetingCache = "Guest"
  try {
    await SecureStore.deleteItemAsync(DISPLAY_NAME_KEY)
  } catch {
    // ignore
  }
  try {
    await AsyncStorage.removeItem(DISPLAY_NAME_KEY)
  } catch {
    // ignore
  }
}

export async function getLocationLabel(
  fallback = DEFAULT_SAVED_LOCATION.label,
): Promise<string> {
  const details = await getSavedLocation()
  if (details?.label?.trim()) return details.label.trim()
  const value = await AsyncStorage.getItem(LOCATION_KEY)
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : fallback
}

export async function getSavedLocation(): Promise<SavedLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_DETAILS_KEY)
    if (!raw) {
      const label = await AsyncStorage.getItem(LOCATION_KEY)
      return label?.trim() ? { label: label.trim() } : null
    }
    const parsed = JSON.parse(raw) as SavedLocation
    if (!parsed?.label?.trim()) return null
    return {
      label: parsed.label.trim(),
      placeId: parsed.placeId,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      city: parsed.city,
      area: parsed.area,
      state: parsed.state,
      formattedAddress: parsed.formattedAddress,
    }
  } catch {
    return null
  }
}

export async function setLocationLabel(label: string): Promise<void> {
  await setSavedLocation({ label: label.trim() })
}

export async function setSavedLocation(location: SavedLocation): Promise<void> {
  const label = location.label.trim()
  if (!label) return
  const next: SavedLocation = {
    label,
    placeId: location.placeId,
    latitude: location.latitude,
    longitude: location.longitude,
    city: location.city,
    area: location.area,
    state: location.state,
    formattedAddress: location.formattedAddress,
  }
  await AsyncStorage.setItem(LOCATION_KEY, label)
  await AsyncStorage.setItem(LOCATION_DETAILS_KEY, JSON.stringify(next))
}

export async function clearConsumerProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY)
  await clearDisplayName()
}

export async function clearLocalSession(): Promise<void> {
  await clearAccessToken()
  await clearConsumerProfile()
}

export async function getConsumerProfile(): Promise<ConsumerProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY)
  if (!raw) {
    const name = await SecureStore.getItemAsync(DISPLAY_NAME_KEY)
    return {
      ...emptyProfile,
      name: name?.trim() ?? "",
      phone: "",
    }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ConsumerProfile>
    return {
      name: parsed.name?.trim() ?? "",
      email: parsed.email?.trim() ?? "",
      phone: parsed.phone?.trim() ?? "",
      gender: parsed.gender?.trim() ?? "",
      dateOfBirth: parsed.dateOfBirth?.trim() ?? "",
      address: parsed.address?.trim() ?? "",
    }
  } catch {
    return { ...emptyProfile }
  }
}

/** Merge known fields into the local profile cache (e.g. phone from OTP verify). */
export async function patchConsumerProfileCache(
  patch: Partial<Pick<ConsumerProfile, "name" | "email" | "phone">>,
): Promise<ConsumerProfile> {
  const current = await getConsumerProfile()
  const next: ConsumerProfile = {
    ...current,
    name: patch.name?.trim() || current.name,
    email: patch.email?.trim() || current.email,
    phone: patch.phone?.trim() || current.phone,
  }
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next))
  if (next.name.trim()) {
    await setDisplayName(next.name)
  }
  return next
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export type ConsumerProfileFieldErrors = Partial<
  Record<"name" | "email" | "dateOfBirth" | "address" | "gender", string>
>

/** Field-level validation for the profile form (required + format). */
export function validateConsumerProfileFields(
  profile: ConsumerProfile,
): ConsumerProfileFieldErrors {
  const errors: ConsumerProfileFieldErrors = {}
  const name = profile.name.trim()
  const email = profile.email.trim()

  if (!name) errors.name = "This is required."
  if (!email) errors.email = "This is required."
  else if (!isValidEmail(email)) errors.email = "Enter a valid email address."

  if (profile.gender && !isSelectableGender(profile.gender)) {
    // Legacy locked values are fine; only reject unknown new selections.
    const allowedLegacy = ["non_binary", "prefer_not_to_say", "other"]
    if (!allowedLegacy.includes(profile.gender)) {
      errors.gender = "Select a valid gender option."
    }
  }

  if (profile.dateOfBirth.trim()) {
    const parsed = Date.parse(profile.dateOfBirth.trim())
    if (Number.isNaN(parsed)) {
      errors.dateOfBirth = "Use YYYY-MM-DD format."
    }
  }

  if (profile.address.trim().length > 500) {
    errors.address = "Address is too long (max 500 characters)."
  }

  return errors
}

/** Normalize Indian mobile to 10 digits when possible. */
export function normalizeMobileDigits(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1)
  return digits
}

export async function saveConsumerProfile(
  profile: ConsumerProfile,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = profile.name.trim()
  const email = profile.email.trim()
  if (!name) return { ok: false, error: "Name is required." }
  if (!email) return { ok: false, error: "Email is required." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." }
  }
  if (profile.gender && !isSelectableGender(profile.gender)) {
    const allowedLegacy = ["non_binary", "prefer_not_to_say", "other"]
    if (!allowedLegacy.includes(profile.gender)) {
      return { ok: false, error: "Select a valid gender option." }
    }
  }
  if (profile.dateOfBirth.trim()) {
    const parsed = Date.parse(profile.dateOfBirth.trim())
    if (Number.isNaN(parsed)) {
      return { ok: false, error: "Enter a valid date of birth." }
    }
  }
  if (profile.address.trim().length > 500) {
    return { ok: false, error: "Address is too long (max 500 characters)." }
  }

  const next: ConsumerProfile = {
    name,
    email,
    phone: profile.phone.trim(),
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth.trim(),
    address: profile.address.trim(),
  }
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next))
  await setDisplayName(name)
  return { ok: true }
}
