import { API_URL } from "@/lib/config"
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
      throw new ApiError(408, "Request timed out")
    }
    throw error
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
