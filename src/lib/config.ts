import Constants from "expo-constants"

import { assertStagingApiUrl } from "@/lib/env"

/**
 * Glammzo-web origin used by the mobile app (staging / local only).
 * On a physical phone, use your machine LAN IP (not localhost).
 *
 * Examples:
 * - iOS Simulator: http://localhost:4008
 * - Android emulator: http://10.0.2.2:4008
 * - Physical phone: http://192.168.x.x:4008
 *
 * Ensure Glammzo-web is started with development/staging env — never production.
 */
const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ||
  extra?.apiUrl?.replace(/\/$/, "") ||
  "http://localhost:4008"

assertStagingApiUrl(API_URL)
