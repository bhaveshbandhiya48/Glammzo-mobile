import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { BankIcon, FALLBACK_EMAIL, formatLeft, UpiIcon } from "@/components/payments/AdvancePaymentSheet"
import { PayMethodSheet } from "@/components/payments/PayMethodSheet"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import {
  advanceWebPageUrl,
  createAdvanceOrder,
  fetchPaymentKeyId,
  isAdvanceConfirmed,
  isInAppPaymentAvailable,
  loadPaymentOptions,
  payAdvance,
  type AdvanceOrder,
  type Bank,
  type PayMethod,
  type UpiApp,
} from "@/lib/advance-payment"
import {
  loadSavedPayMethod,
  paySelectionLabel,
  resolveSavedPayMethod,
  savePayMethod,
  type PaySelection,
  type SavedPayMethod,
} from "@/lib/pay-method-memory"
import { formatRupees } from "@/lib/service-pricing"
import { getConsumerProfile } from "@/lib/user"
import { colors, radii, spacing, status as statusColors } from "@/theme/tokens"

type Props = {
  amountRupees: number
  /** Creates the booking (holding the slot) and returns its pay token, or null if it couldn't (the screen says why). */
  reserve: () => Promise<string | null>
  onPaid: (amountRupees: number) => void
  /** The screen's own reason the booking can't be made yet (missing name, no slot…). */
  disabledReason?: string | null
  /** The screen's error for the last reserve attempt. */
  error?: string | null
}

function SelectionIcon({ selection }: { selection: PaySelection }) {
  if (selection.kind === "upi") return <UpiIcon app={selection.app} />
  if (selection.kind === "bank") return <BankIcon code={selection.bank.code} />
  return <Icon name="card-outline" size={18} color={colors.text} />
}

/**
 * Blinkit-style checkout: "Pay using <last app> ▾" on the left, "₹X Pay ›" on the right.
 * One tap holds the slot and opens the UPI app. A failed or cancelled payment stays here with the
 * slot still held, so the client can tap again or switch apps.
 */
export function OneTapPayBar({ amountRupees, reserve, onPaid, disabledReason, error: screenError }: Props) {
  const insets = useSafeAreaInsets()
  const inApp = isInAppPaymentAvailable()
  const [optionsReady, setOptionsReady] = useState(!inApp)
  const [keyFailed, setKeyFailed] = useState(false)
  const [upiApps, setUpiApps] = useState<UpiApp[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [saved, setSaved] = useState<SavedPayMethod | null>(null)
  const [selection, setSelection] = useState<PaySelection | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [heldToken, setHeldToken] = useState<string | null>(null)
  const [order, setOrder] = useState<AdvanceOrder | null>(null)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const leftForWeb = useRef(false)
  /** First booking: picking a method in the sheet pays straight away. */
  const payAfterPick = useRef(false)

  // Payment options and the last used method, without touching the slot.
  useEffect(() => {
    if (!inApp) return
    let active = true
    Promise.all([fetchPaymentKeyId().then(loadPaymentOptions), loadSavedPayMethod()])
      .then(([options, last]) => {
        if (!active) return
        setUpiApps(options.upiApps)
        setBanks(options.banks)
        setSaved(last)
        setSelection((current) => current ?? resolveSavedPayMethod(last, options))
      })
      .catch(() => {
        if (active) setKeyFailed(true)
      })
      .finally(() => {
        if (active) setOptionsReady(true)
      })
    return () => {
      active = false
    }
  }, [inApp])

  useEffect(() => {
    if (!order?.holdExpiresAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [order?.holdExpiresAt])

  const holdEnds = order?.holdExpiresAt ? Date.parse(order.holdExpiresAt) : null
  const left = holdEnds ? holdEnds - now : null
  const expired = left != null && left <= 0

  // Back from the card web page: the booking may be confirmed by now.
  useEffect(() => {
    if (!heldToken) return
    const token = heldToken
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !leftForWeb.current) return
      leftForWeb.current = false
      void isAdvanceConfirmed(token, 3).then((confirmed) => {
        if (confirmed) onPaid(amountRupees)
      })
    })
    return () => sub.remove()
  }, [amountRupees, heldToken, onPaid])

  /** The slot is held from the Pay tap on, and only once. */
  const hold = useCallback(async () => {
    if (heldToken) return heldToken
    const token = await reserve()
    if (token) setHeldToken(token)
    return token
  }, [heldToken, reserve])

  const payWith = useCallback(
    async (chosen: PaySelection | null) => {
      if (paying || expired) return
      setError(null)
      setNotice(null)
      // No in-app payment (or no method yet in a build without it): the secure web page.
      const useWeb = !inApp || keyFailed || chosen?.kind === "card"
      if (!useWeb && !chosen) {
        payAfterPick.current = true
        setPickerOpen(true)
        return
      }
      setPaying(true)
      try {
        const token = await hold()
        if (!token) return
        if (useWeb) {
          leftForWeb.current = true
          void Linking.openURL(advanceWebPageUrl(token))
          return
        }
        let current = order
        if (!current) {
          current = await createAdvanceOrder(token)
          setOrder(current)
        }
        const method: PayMethod =
          chosen!.kind === "upi"
            ? { method: "upi", packageName: chosen!.app.packageName }
            : { method: "netbanking", bank: (chosen as { kind: "bank"; bank: Bank }).bank.code }
        const profile = await getConsumerProfile().catch(() => null)
        const outcome = await payAdvance({
          token,
          order: current,
          method,
          email: profile?.email?.trim() || FALLBACK_EMAIL,
        })
        if (outcome.kind === "paid") {
          await savePayMethod(chosen!)
          onPaid(current.amountPaise / 100)
        } else if (outcome.kind === "refunding") {
          setNotice("Your payment came in after the time was released. We'll refund it in full.")
        } else if (outcome.kind === "checking") {
          setNotice("We're checking your payment. If it went through, your booking will update in a few minutes.")
        } else {
          setError(outcome.message ?? "The payment wasn't completed. Tap Pay to try again, or switch how you pay.")
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start the payment. Tap Pay to try again.")
      } finally {
        setPaying(false)
      }
    },
    [expired, hold, inApp, keyFailed, onPaid, order, paying],
  )

  const blocked = Boolean(disabledReason) || expired || !optionsReady
  const message = expired
    ? "This time is no longer held. Please go back and pick a time again."
    : (error ?? screenError ?? null)
  const showMethod = inApp && !keyFailed

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {notice ? (
          <Text variant="caption" style={styles.notice} accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}
        {message ? (
          <Text variant="caption" color={statusColors.dangerFg} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : disabledReason ? (
          <Text variant="caption" muted>
            {disabledReason}
          </Text>
        ) : null}

        <View style={styles.row}>
          {showMethod && selection ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Pay using ${paySelectionLabel(selection)}. Change payment method`}
              disabled={paying}
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [styles.method, pressed && styles.pressed]}
            >
              <Text style={styles.methodLabel}>PAY USING</Text>
              <View style={styles.methodRow}>
                <View style={styles.methodIcon}>
                  <SelectionIcon selection={selection} />
                </View>
                <Text variant="bodyStrong" numberOfLines={1} style={styles.methodName}>
                  {paySelectionLabel(selection)}
                </Text>
                <Icon name="chevron-down" size={16} color={colors.text} />
              </View>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              showMethod && !selection
                ? `Choose payment method to pay ${formatRupees(amountRupees)}`
                : `Pay ${formatRupees(amountRupees)} advance`
            }
            accessibilityState={{ disabled: blocked || paying, busy: paying }}
            disabled={blocked || paying}
            onPress={() => void payWith(showMethod ? selection : null)}
            style={({ pressed }) => [
              styles.pay,
              !(showMethod && selection) && styles.payWide,
              (blocked || paying) && styles.payDisabled,
              pressed && styles.payPressed,
            ]}
          >
            {showMethod && !selection && optionsReady ? (
              <Text style={styles.payText}>Choose payment method</Text>
            ) : (
              <View>
                <Text style={styles.payAmount}>{formatRupees(amountRupees)}</Text>
                <Text style={styles.paySub}>
                  {left != null && !expired ? `SLOT HELD ${formatLeft(left)}` : "ADVANCE"}
                </Text>
              </View>
            )}
            {paying || !optionsReady ? (
              <ActivityIndicator color={colors.primaryFg} />
            ) : (
              <View style={styles.payCta}>
                <Text style={styles.payText}>{showMethod && !selection ? formatRupees(amountRupees) : "Pay"}</Text>
                <Icon name="chevron-forward" size={16} color={colors.primaryFg} />
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <PayMethodSheet
        visible={pickerOpen}
        loading={!optionsReady}
        upiApps={upiApps}
        banks={banks}
        selected={selection}
        lastUsed={saved}
        onPick={(picked) => {
          setPickerOpen(false)
          setError(null)
          if (picked.kind !== "card") setSelection(picked)
          // Card always pays straight away (it's a web page); the first pick does too.
          if (picked.kind === "card" || payAfterPick.current) {
            payAfterPick.current = false
            // Let the sheet slide away before the payment app opens.
            setTimeout(() => void payWith(picked), 250)
          }
        }}
        onClose={() => {
          payAfterPick.current = false
          setPickerOpen(false)
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  method: { flex: 1, minWidth: 0, minHeight: 52, justifyContent: "center", borderRadius: radii.md },
  methodLabel: { fontSize: 11, lineHeight: 14, letterSpacing: 0.6, fontFamily: "Geist_600SemiBold", color: colors.textMuted },
  methodRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  methodIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  methodName: { flexShrink: 1 },
  pressed: { opacity: 0.6 },
  pay: {
    flexBasis: 176,
    flexGrow: 0,
    minHeight: 56,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  payWide: { flexGrow: 1, flexBasis: "auto" },
  payDisabled: { opacity: 0.45 },
  payPressed: { backgroundColor: colors.primaryPressed },
  payAmount: { fontSize: 16, lineHeight: 20, fontFamily: "Geist_700Bold", color: colors.primaryFg },
  paySub: { fontSize: 10, lineHeight: 13, letterSpacing: 0.6, color: "rgba(255,255,255,0.75)" },
  payCta: { flexDirection: "row", alignItems: "center", gap: 2 },
  payText: { fontSize: 16, lineHeight: 20, fontFamily: "Geist_600SemiBold", color: colors.primaryFg },
  notice: {
    backgroundColor: statusColors.infoBg,
    color: statusColors.infoFg,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
})
