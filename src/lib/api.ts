import NetInfo from "@react-native-community/netinfo"

import { API_URL } from "@/lib/config"
import { isDeviceOffline } from "@/lib/network"
import { getAccessToken } from "@/lib/session"
import { clearLocalSession } from "@/lib/user"

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  auth?: boolean
  /** Request timeout in ms. Defaults to 25s (local Next compile can exceed 12s). */
  timeoutMs?: number
}

export class ApiError extends Error {
  status: number
  /** Optional server extras (e.g. debugOtp on auth failures). */
  extras: Record<string, unknown>

  constructor(
    status: number,
    message: string,
    extras: Record<string, unknown> = {},
  ) {
    super(message)
    this.status = status
    this.extras = extras
  }
}

export const OFFLINE_MESSAGE = "You're offline. Check your Wi-Fi or mobile data and try again."
export const SERVER_UNREACHABLE_MESSAGE = "Glammzo isn't responding right now. Try again in a moment."
export const TIMED_OUT_MESSAGE = "That took too long. Check your connection and try again."

/** The request never got an answer: say "you're offline" when that's why, not fetch's raw error. */
export async function networkFailure(error: unknown): Promise<ApiError> {
  if (__DEV__) console.warn(`[api] request to ${API_URL} failed`, error)
  const state = await NetInfo.fetch().catch(() => null)
  const offline = state ? isDeviceOffline(state) : false
  return new ApiError(0, offline ? OFFLINE_MESSAGE : SERVER_UNREACHABLE_MESSAGE, {
    network: offline ? "offline" : "unreachable",
  })
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  if (options.auth !== false) {
    const token = await getAccessToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  const timeoutMs = options.timeoutMs ?? 25_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || controller.signal.aborted)
    ) {
      throw new ApiError(408, TIMED_OUT_MESSAGE)
    }
    throw await networkFailure(error)
  } finally {
    clearTimeout(timeoutId)
  }

  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      throw new ApiError(response.status, "Invalid JSON response")
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed (${response.status})`
    const extras =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}
    if (response.status === 401 && options.auth !== false) {
      await clearLocalSession()
    }
    throw new ApiError(response.status, message, extras)
  }

  return data as T
}
