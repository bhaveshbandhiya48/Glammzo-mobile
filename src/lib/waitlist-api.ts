import { apiFetch } from "@/lib/api"

export type WaitlistEntry = {
  id: string
  kind: "salon" | "artist"
  providerSlug: string
  providerName: string
  date: string
  status: "waiting" | "slot_opened" | "notified"
  serviceIds: string[]
}

export async function fetchWaitlist() {
  return (await apiFetch<{ ok: boolean; entries: WaitlistEntry[] }>("/api/mobile/waitlist")).entries ?? []
}

export async function joinWaitlist(input: {
  kind: "salon" | "artist"
  provider: string
  date: string
  serviceIds: string[]
}) {
  return (
    await apiFetch<{ ok: boolean; entries: WaitlistEntry[] }>("/api/mobile/waitlist", { method: "POST", body: input })
  ).entries ?? []
}

export async function leaveWaitlist(id: string) {
  return (
    await apiFetch<{ ok: boolean; entries: WaitlistEntry[] }>(`/api/mobile/waitlist/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
  ).entries ?? []
}
