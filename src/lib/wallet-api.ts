import { apiFetch } from "@/lib/api"
import {
  LOYALTY_DISCOUNT_CAP_RUPEES,
  LOYALTY_VISITS_PER_FREE,
  type LoyaltySummary,
} from "@/lib/loyalty"

export type WalletSummary = {
  balancePaise: number
  balanceRupees: number
}

export type WalletLedgerEntry = {
  id: string
  deltaPaise: number
  reason: string
  createdAt: string
  appointmentId?: string | null
}

export async function fetchWallet() {
  return apiFetch<{
    ok: boolean
    wallet: WalletSummary
    ledger: WalletLedgerEntry[]
    campaign: {
      code: string
      title: string
      rewardPaise: number
      remainingClaims: number
      active: boolean
    } | null
  }>("/api/mobile/wallet")
}

export async function fetchLoyalty(): Promise<LoyaltySummary> {
  const data = await apiFetch<{
    ok: boolean
    loyalty: {
      completedVisits: number
      freeServiceCredits: number
      stampsTowardNextFree: number
    }
  }>("/api/mobile/loyalty")

  const completedVisits = data.loyalty.completedVisits ?? 0
  const freeServiceCredits = data.loyalty.freeServiceCredits ?? 0
  const stampsTowardNextFree =
    data.loyalty.stampsTowardNextFree ?? completedVisits % LOYALTY_VISITS_PER_FREE
  const visitsLeft = Math.max(0, LOYALTY_VISITS_PER_FREE - stampsTowardNextFree)

  return {
    completedVisits,
    freeServiceCredits,
    stampsTowardNextFree,
    visitsLeft,
  }
}

export { LOYALTY_DISCOUNT_CAP_RUPEES, LOYALTY_VISITS_PER_FREE }
