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
 *
 * In Expo Go / dev, if .env still has an old LAN IP, we rewrite the host to
 * match Metro’s current address (see packager hostUri) so Wi‑Fi IP changes
 * don’t strand the app on a dead IP.
 */
const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined

/**
 * Host Expo Metro is serving from, e.g. "192.168.1.7" from "192.168.1.7:8082".
 */
function expoDevHost(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    // Expo Go
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost,
    (
      Constants as {
        manifest2?: { extra?: { expoClient?: { hostUri?: string } } }
      }
    ).manifest2?.extra?.expoClient?.hostUri,
    (Constants as { debuggerHost?: string }).debuggerHost,
  ]

  for (const raw of candidates) {
    if (!raw || typeof raw !== "string") continue
    const host = raw.split(":")[0]?.trim()
    if (!host) continue
    if (host === "localhost" || host === "127.0.0.1") continue
    return host
  }
  return null
}

function isPrivateLanHost(hostname: string): boolean {
  if (hostname === "10.0.2.2") return false // Android emulator loopback alias
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  )
}

/**
 * Prefer Expo’s live LAN host when .env points at a (possibly stale) private IP.
 * Leave localhost / 10.0.2.2 / public hosts unchanged.
 */
function alignDevLanUrl(url: string): string {
  if (typeof __DEV__ === "undefined" || !__DEV__) return url

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  if (!isPrivateLanHost(parsed.hostname)) return url

  const live = expoDevHost()
  if (!live || live === parsed.hostname) return url

  const previous = url
  parsed.hostname = live
  const next = parsed.toString().replace(/\/$/, "")
  console.info(`[Glammzo] Aligned local URL to Metro host: ${next} (was ${previous})`)
  return next
}

const rawApiUrl =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ||
  extra?.apiUrl?.replace(/\/$/, "") ||
  "http://localhost:4008"

export const API_URL = alignDevLanUrl(rawApiUrl)

assertStagingApiUrl(API_URL)

/**
 * Glammzo CRM origin. Solo artists live in the CRM, so artist browsing calls it directly.
 * Physical phone: use the machine's LAN IP, e.g. http://192.168.x.x:4005.
 */
const crmExtra = Constants.expoConfig?.extra as { crmUrl?: string } | undefined

const rawCrmUrl =
  process.env.EXPO_PUBLIC_CRM_URL?.replace(/\/$/, "") ||
  crmExtra?.crmUrl?.replace(/\/$/, "") ||
  "http://localhost:4005"

export const CRM_URL = alignDevLanUrl(rawCrmUrl)
