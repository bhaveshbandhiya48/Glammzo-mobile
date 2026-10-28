import { apiFetch } from "@/lib/api"
import { CRM_URL } from "@/lib/config"

export type MyPackage = {
  id: string
  token: string | null
  salonSlug: string
  salonName: string
  packageName: string
  priceRupees: number
  status: "pending_payment" | "active" | "used" | "expired"
  expiresAt: string | null
  sessions: { serviceId: string; serviceName: string; left: number; total: number }[]
}

export function packagePayUrl(token: string) {
  return `${CRM_URL}/pay/package/${encodeURIComponent(token)}`
}

export async function fetchMyPackages() {
  return (await apiFetch<{ ok: boolean; packages: MyPackage[] }>("/api/mobile/packages")).packages ?? []
}

/** Starts a prepaid purchase; returns the web payment page URL. */
export async function startPackagePurchase(salon: string, packageId: string) {
  const { token } = await apiFetch<{ ok: boolean; token: string }>("/api/mobile/packages", {
    method: "POST",
    body: { salon, packageId },
  })
  return packagePayUrl(token)
}

/** Sessions left per service at a salon, from active packages. */
export function sessionsLeftAt(packages: MyPackage[], salonSlug: string) {
  const left = new Map<string, number>()
  for (const pkg of packages) {
    if (pkg.status !== "active" || pkg.salonSlug !== salonSlug) continue
    if (pkg.expiresAt && Date.parse(pkg.expiresAt) <= Date.now()) continue
    for (const s of pkg.sessions) left.set(s.serviceId, (left.get(s.serviceId) ?? 0) + s.left)
  }
  return left
}
