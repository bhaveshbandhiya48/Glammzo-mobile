import { useCallback, useEffect, useMemo, useState } from "react"

import { ApiError } from "@/lib/api"
import {
  fetchCheckoutAppOffers,
  type AppOfferSelection,
  type CheckoutAppOffer,
  type CheckoutAppOffers,
} from "@/lib/app-offers-api"

type CheckoutRequest = Parameters<typeof fetchCheckoutAppOffers>[0]

/**
 * What the customer chose: let Glammzo pick the best automatic offer, a specific offer from the
 * list, a typed code, or no offer at all.
 */
type Choice =
  | { kind: "auto" }
  | { kind: "offer"; offerId: string }
  | { kind: "code"; code: string }
  | { kind: "none" }

const EMPTY: CheckoutAppOffers = {
  offers: [],
  autoApplied: null,
  typed: null,
  typedError: null,
}

/**
 * Glammzo offers for a checkout cart. Re-checks with the server whenever the cart changes, so
 * the saving shown is the one the booking gets. `request` is null while the cart is empty or the
 * customer is signed out.
 */
export function useCheckoutAppOffers(request: CheckoutRequest | null) {
  const [choice, setChoice] = useState<Choice>({ kind: "auto" })
  const [data, setData] = useState<CheckoutAppOffers>(EMPTY)
  const [loading, setLoading] = useState(false)
  const typedCode = choice.kind === "code" ? choice.code : null
  const key = request ? JSON.stringify({ ...request, code: typedCode }) : ""

  useEffect(() => {
    if (!key) {
      setData(EMPTY)
      return
    }
    let active = true
    setLoading(true)
    fetchCheckoutAppOffers(JSON.parse(key) as CheckoutRequest)
      .then((next) => {
        if (active) setData(next)
      })
      .catch(() => {
        if (active) setData(EMPTY)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [key])

  const applied: CheckoutAppOffer | null = useMemo(() => {
    if (choice.kind === "auto") return data.autoApplied
    if (choice.kind === "code") return data.typed
    if (choice.kind === "offer") {
      const offer = data.offers.find((item) => item.id === choice.offerId)
      return offer?.status === "usable" ? offer : null
    }
    return null
  }, [choice, data])

  /** A picked offer or typed code that stopped fitting the cart, with the reason. */
  const problem = useMemo(() => {
    if (loading) return null
    if (choice.kind === "code" && !data.typed) {
      return data.typedError && data.typedError !== "not_found" ? data.typedError : null
    }
    if (choice.kind === "offer" && !applied) {
      return (
        data.offers.find((item) => item.id === choice.offerId)?.note ??
        "This offer doesn't fit your booking now."
      )
    }
    return null
  }, [loading, choice, data, applied])

  /**
   * Checks a typed code. "not_found" means it isn't a Glammzo code, so the caller can try it as
   * the salon's or artist's own code.
   */
  const tryCode = useCallback(
    async (raw: string): Promise<{ ok: true; offer: CheckoutAppOffer } | { ok: false; error: string }> => {
      const code = raw.trim().toUpperCase()
      if (!request || !code) return { ok: false, error: "not_found" }
      try {
        const result = await fetchCheckoutAppOffers({ ...request, code })
        if (result.typed) {
          setData(result)
          setChoice({ kind: "code", code })
          return { ok: true, offer: result.typed }
        }
        return { ok: false, error: result.typedError ?? "not_found" }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof ApiError ? error.message : "Couldn't check the code.",
        }
      }
    },
    [request],
  )

  const selection: AppOfferSelection = useMemo(() => {
    if (choice.kind === "offer") return { offerId: choice.offerId, auto: false }
    if (choice.kind === "code") return { code: choice.code, auto: false }
    return { auto: choice.kind === "auto" }
  }, [choice])

  return {
    offers: data.offers,
    applied,
    discountRupees: applied?.discountRupees ?? 0,
    isAutomatic: choice.kind === "auto",
    loading,
    problem,
    selection,
    pick: (offer: CheckoutAppOffer) => setChoice({ kind: "offer", offerId: offer.id }),
    tryCode,
    remove: () => setChoice({ kind: "none" }),
    useBest: () => setChoice({ kind: "auto" }),
  }
}

export type CheckoutAppOffersState = ReturnType<typeof useCheckoutAppOffers>
