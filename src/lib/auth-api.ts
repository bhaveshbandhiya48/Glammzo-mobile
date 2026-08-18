import { apiFetch } from "@/lib/api"
import { setAccessToken } from "@/lib/session"

export type OtpRequestResponse = {
  ok: boolean
  challengeToken: string
  message?: string
  debugOtp?: string
  error?: string
}

export type OtpVerifyResponse = {
  ok: boolean
  accessToken: string
  expiresIn: number
  needsName?: boolean
  user: { phone: string; name?: string; email?: string }
  error?: string
  debugOtp?: string
}

export async function requestOtp(phone: string) {
  return apiFetch<OtpRequestResponse>("/api/mobile/auth/otp/request", {
    method: "POST",
    auth: false,
    body: { phone },
  })
}

export async function verifyOtp(challengeToken: string, otp: string) {
  const result = await apiFetch<OtpVerifyResponse>("/api/mobile/auth/otp/verify", {
    method: "POST",
    auth: false,
    body: { challengeToken, otp },
  })
  if (result.accessToken) {
    await setAccessToken(result.accessToken)
  }
  return result
}

export async function saveDisplayName(name: string) {
  const trimmed = name.trim()
  const result = await apiFetch<{
    ok: boolean
    name: string
    accessToken?: string
  }>("/api/mobile/profile/display-name", {
    method: "POST",
    body: { name: trimmed },
  })
  if (result.accessToken) {
    await setAccessToken(result.accessToken)
  }
  return result
}

export async function fetchMe() {
  return apiFetch<{
    ok: boolean
    authenticated: boolean
    user: { phone: string; name?: string; email?: string }
  }>("/api/mobile/me")
}
