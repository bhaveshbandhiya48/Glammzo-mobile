import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppState, Image, Linking, Pressable, StyleSheet, View } from "react-native"

import { showAdvancePaidAlert, showAdvanceRefundAlert } from "@/components/payments/PendingPaymentWatcher"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
import { SkeletonBone } from "@/components/ui/Skeleton"
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
import { formatRupees } from "@/lib/service-pricing"
import { getConsumerProfile } from "@/lib/user"
import { colors, radii, spacing, status as statusColors } from "@/theme/tokens"

/** The banks most clients look for, shown first. */
const POPULAR_BANKS = ["HDFC", "SBIN", "ICIC", "UTIB", "KKBK"]
/** Razorpay needs an email on every payment; artist clients may not have added one. */
const FALLBACK_EMAIL = "payments@glammzo.com"

type Selection =
  | { kind: "upi"; app: UpiApp }
  | { kind: "bank"; bank: Bank }
  | null

function formatLeft(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

function Option({
  selected,
  title,
  subtitle,
  leading,
  chevron,
  onPress,
}: {
  selected?: boolean
  title: string
  subtitle?: string
  leading: React.ReactNode
  chevron?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={chevron ? "button" : "radio"}
      accessibilityState={chevron ? undefined : { checked: Boolean(selected) }}
      accessibilityLabel={title}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
    >
      <View style={styles.optionIcon}>{leading}</View>
      <View style={styles.optionText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" muted numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {chevron ? (
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      ) : (
        <View style={[styles.radio, selected && styles.radioOn]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      )}
    </Pressable>
  )
}

function UpiIcon({ app }: { app: UpiApp }) {
  const uri = app.iconBase64
    ? app.iconBase64.startsWith("data:")
      ? app.iconBase64
      : `data:image/png;base64,${app.iconBase64}`
    : app.logoUrl
  if (uri) return <Image source={{ uri }} style={styles.logo} accessibilityIgnoresInvertColors />
  return <Icon name="phone-portrait-outline" size={20} color={colors.text} />
}

function BankIcon({ code }: { code: string }) {
  return (
    <Image
      source={{ uri: `https://cdn.razorpay.com/bank/${encodeURIComponent(code)}.gif` }}
      style={styles.logo}
      accessibilityIgnoresInvertColors
    />
  )
}

function OptionsSkeleton() {
  return (
    <View style={styles.card} accessibilityLabel="Loading payment options">
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.option}>
          <SkeletonBone width={40} height={40} radius={radii.md} />
          <SkeletonBone width="55%" />
        </View>
      ))}
    </View>
  )
}

type Props = {
  visible: boolean
  /** An existing held booking. Leave null with `reserve` when nothing is held yet. */
  token: string | null
  /** Holds the slot on the Pay tap and returns its token, or null if it couldn't (the parent says why). */
  reserve?: () => Promise<string | null>
  /** Known before the order exists, so the amount shows straight away. */
  summary?: { amountRupees: number; label: string }
  onPaid: (amountRupees: number) => void
  /** Closed without paying. `held`: a slot is held until its time runs out. */
  onClose: (held: boolean) => void
  /** Ask before closing without paying (the booking flow, where nothing is confirmed yet). */
  confirmBeforeClose?: boolean
}

/**
 * The payment sheet for an artist's advance: the client picks a UPI app or bank here and Razorpay's
 * SDK takes it from there, without opening a browser. Card payments use the secure web page until
 * our own card form is cleared with Razorpay.
 */
export function AdvancePaymentSheet({ visible, token: givenToken, reserve, summary, onPaid, onClose, confirmBeforeClose = false }: Props) {
  const inApp = isInAppPaymentAvailable()
  const [order, setOrder] = useState<AdvanceOrder | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [optionsReady, setOptionsReady] = useState(false)
  const [upiApps, setUpiApps] = useState<UpiApp[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [selection, setSelection] = useState<Selection>(null)
  const [paying, setPaying] = useState(false)
  /** The payment screen has closed and we're asking the server; the client may close the sheet now. */
  const [confirming, setConfirming] = useState(false)
  /** Closed while confirming: the result is left to the check that runs when the app comes back. */
  const closedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [choosingBank, setChoosingBank] = useState(false)
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [bankQuery, setBankQuery] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const leftForWeb = useRef(false)
  const [heldToken, setHeldToken] = useState<string | null>(null)
  const [keyFailed, setKeyFailed] = useState(false)
  const token = givenToken ?? heldToken
  const canReserve = reserve != null

  // Nothing held yet: list the payment options without touching the slot.
  useEffect(() => {
    if (!visible || !canReserve || optionsReady || !inApp) return
    let active = true
    fetchPaymentKeyId()
      .then(loadPaymentOptions)
      .then((options) => {
        if (!active) return
        setUpiApps(options.upiApps)
        setBanks(options.banks)
        const firstApp = options.upiApps[0]
        setSelection((current) => current ?? (firstApp ? { kind: "upi", app: firstApp } : null))
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
  }, [canReserve, inApp, optionsReady, visible])

  useEffect(() => {
    // The Pay tap makes its own order for a slot it has just held.
    if (!givenToken) return
    const token = givenToken
    let active = true
    createAdvanceOrder(token)
      .then(async (created) => {
        if (!active) return
        setOrder(created)
        const options = await loadPaymentOptions(created.keyId)
        if (!active) return
        setUpiApps(options.upiApps)
        setBanks(options.banks)
        setOptionsReady(true)
        const firstApp = options.upiApps[0]
        setSelection((current) => current ?? (firstApp ? { kind: "upi", app: firstApp } : null))
      })
      .catch((e: unknown) => {
        if (active) setLoadError(e instanceof Error ? e.message : "Could not start the payment.")
      })
    return () => {
      active = false
    }
  }, [givenToken])

  useEffect(() => {
    if (!visible) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [visible])

  const holdEnds = order?.holdExpiresAt ? Date.parse(order.holdExpiresAt) : null
  const left = holdEnds ? holdEnds - now : null
  const expired = left != null && left <= 0
  const amountRupees = order ? order.amountPaise / 100 : summary?.amountRupees
  const amount = amountRupees != null ? formatRupees(amountRupees) : ""
  const alreadyPaid = loadError != null && /already paid/i.test(loadError)

  // Coming back from the web page for cards: the booking may be confirmed by now.
  useEffect(() => {
    if (!token) return
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !leftForWeb.current) return
      leftForWeb.current = false
      void isAdvanceConfirmed(token, 3).then((confirmed) => {
        if (confirmed) onPaid(amountRupees ?? 0)
      })
    })
    return () => sub.remove()
  }, [amountRupees, onPaid, token])

  /** The slot is held from here on, and not before. */
  const holdSlot = useCallback(async () => {
    if (token) return token
    const held = (await reserve?.()) ?? null
    if (held) setHeldToken(held)
    return held
  }, [reserve, token])

  const openWebPage = useCallback(async () => {
    setPaying(true)
    const held = await holdSlot()
    setPaying(false)
    if (!held) return
    leftForWeb.current = true
    void Linking.openURL(advanceWebPageUrl(held))
  }, [holdSlot])

  const pay = useCallback(async () => {
    if (!selection) return
    const method: PayMethod =
      selection.kind === "upi"
        ? { method: "upi", packageName: selection.app.packageName }
        : { method: "netbanking", bank: selection.bank.code }
    setPaying(true)
    setError(null)
    setNotice(null)
    const held = await holdSlot()
    if (!held) {
      setPaying(false)
      return
    }
    let current = order
    if (!current) {
      try {
        current = await createAdvanceOrder(held)
        setOrder(current)
      } catch (e) {
        setPaying(false)
        setError(e instanceof Error ? e.message : "Could not start the payment. You can try again.")
        return
      }
    }
    const profile = await getConsumerProfile().catch(() => null)
    closedRef.current = false
    const outcome = await payAdvance({
      token: held,
      order: current,
      method,
      email: profile?.email?.trim() || FALLBACK_EMAIL,
      onConfirming: () => {
        setConfirming(true)
        setNotice("Confirming your payment…")
      },
    })
    setPaying(false)
    setConfirming(false)
    setNotice(null)
    if (closedRef.current) {
      // The sheet is gone, so say it here; a payment still unknown is checked when the app comes back.
      if (outcome.kind === "paid") showAdvancePaidAlert()
      else if (outcome.kind === "refunding") showAdvanceRefundAlert()
      return
    }
    if (outcome.kind === "paid") onPaid(current.amountPaise / 100)
    else if (outcome.kind === "refunding") {
      setNotice("Your payment came in after the time was released. We'll refund it in full.")
    } else if (outcome.kind === "checking") {
      setNotice("We're checking your payment. If it went through, your booking will update in a few minutes.")
    } else {
      setError(outcome.message ?? "The payment wasn't completed. You can try again.")
    }
  }, [holdSlot, onPaid, order, selection])

  const popularBanks = useMemo(() => {
    const popular = POPULAR_BANKS.map((code) => banks.find((b) => b.code === code)).filter((b): b is Bank => b != null)
    // An account may not offer these banks: still show some rather than only "All banks".
    return popular.length > 0 ? popular : banks.slice(0, 5)
  }, [banks])
  const shownBanks = useMemo(() => {
    const q = bankQuery.trim().toLowerCase()
    return q ? banks.filter((b) => b.name.toLowerCase().includes(q)) : banks
  }, [bankQuery, banks])

  const selectedLabel = selection?.kind === "upi" ? selection.app.name : selection?.bank.name
  const ready = (order != null || (canReserve && !givenToken)) && !loadError
  const showInApp = inApp && !keyFailed
  const label = order ? `${order.serviceName} with ${order.artistName}` : summary?.label
  const showFooter = showInApp && !loadError

  if (confirmingLeave) {
    return (
      <BottomSheet
        visible={visible}
        title="Leave without paying?"
        contentKey="leave"
        compact
        scroll={false}
        dismissible={false}
        onClose={() => undefined}
      >
        <View style={styles.leave}>
          <Text muted>
            Your booking isn&apos;t confirmed yet.
            {left != null && left > 0 ? ` We'll hold your slot for ${formatLeft(left)}, ` : " We'll hold your slot for a few minutes, "}
            and you can finish paying from Home.
          </Text>
          <Button label="Keep paying" onPress={() => setConfirmingLeave(false)} />
          <Button label="Leave" variant="secondary" onPress={() => onClose(true)} />
        </View>
      </BottomSheet>
    )
  }

  if (choosingBank) {
    return (
      <BottomSheet
        visible={visible}
        title="Choose your bank"
        expanded
        contentKey="banks"
        dismissible={false}
        onClose={() => undefined}
        stickyHeader={
          <Input value={bankQuery} onChangeText={setBankQuery} placeholder="Search banks" accessibilityLabel="Search banks" />
        }
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setChoosingBank(false)
            setBankQuery("")
          }}
          style={styles.backRow}
        >
          <Icon name="chevron-back" size={18} color={colors.text} />
          <Text variant="bodyStrong">Back to payment options</Text>
        </Pressable>
        {shownBanks.map((bank) => (
          <Option
            key={bank.code}
            title={bank.name}
            leading={<BankIcon code={bank.code} />}
            selected={selection?.kind === "bank" && selection.bank.code === bank.code}
            onPress={() => {
              setSelection({ kind: "bank", bank })
              setChoosingBank(false)
              setBankQuery("")
            }}
          />
        ))}
        {shownBanks.length === 0 ? (
          <Text variant="caption" muted style={styles.empty}>
            No bank found.
          </Text>
        ) : null}
      </BottomSheet>
    )
  }

  return (
    <BottomSheet
      visible={visible}
      title="Pay advance"
      contentKey="methods"
      dismissible={!paying || confirming}
      onClose={() => {
        if (confirming) closedRef.current = true
        onClose(token != null)
      }}
      confirmClose={
        confirmBeforeClose && token != null && !expired && !loadError && !confirming ? () => setConfirmingLeave(true) : undefined
      }
      footer={
        showFooter ? (
          <View style={styles.footer}>
            {notice ? (
              <Text variant="caption" style={styles.notice} accessibilityLiveRegion="polite">
                {notice}
              </Text>
            ) : null}
            {error ? (
              <Text variant="caption" color={statusColors.dangerFg} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <Button
              label={selectedLabel ? `Pay ${amount} with ${selectedLabel}` : `Pay ${amount}`}
              loading={paying}
              disabled={!ready || !selection || expired}
              onPress={() => void pay()}
            />
          </View>
        ) : undefined
      }
    >
      <View style={styles.summary}>
        <View style={styles.summaryCopy}>
          {amount ? <Text style={styles.amount}>{amount}</Text> : <SkeletonBone width={96} height={32} />}
          {label ? (
            <Text variant="caption" muted numberOfLines={2}>
              {label}
            </Text>
          ) : null}
        </View>
        {left != null ? (
          <View style={[styles.hold, expired && styles.holdExpired]} accessibilityLiveRegion="none">
            <Icon name="time-outline" size={14} color={expired ? statusColors.dangerFg : statusColors.warnFg} />
            <Text variant="caption" color={expired ? statusColors.dangerFg : statusColors.warnFg}>
              {expired ? "Time ended" : formatLeft(left)}
            </Text>
          </View>
        ) : null}
      </View>

      {expired ? (
        <Text variant="caption" color={statusColors.dangerFg} style={styles.sectionTitle}>
          This time is no longer held. Please book again.
        </Text>
      ) : null}

      {loadError ? (
        <View style={styles.failed}>
          <Text variant="bodyStrong">{/held|paid/i.test(loadError) ? loadError : "We couldn't start the payment"}</Text>
          {/held|paid/i.test(loadError) ? null : (
            <Text variant="caption" muted>
              {loadError}
            </Text>
          )}
          <Button
            label="Close"
            variant="secondary"
            onPress={() => (alreadyPaid ? onPaid(amountRupees ?? 0) : onClose(token != null))}
          />
        </View>
      ) : !ready || (showInApp && !optionsReady) ? (
        <>
          <Text variant="label" muted style={styles.sectionTitle}>
            Loading payment options
          </Text>
          <OptionsSkeleton />
        </>
      ) : (
        <>
          {showInApp ? (
            <>
              <Text variant="label" muted style={styles.sectionTitle}>
                Pay with UPI
              </Text>
              <View style={styles.card} accessibilityRole="radiogroup">
                {upiApps.length === 0 ? (
                  <Text variant="caption" muted style={styles.empty}>
                    No UPI apps found on this phone. You can pay by net banking or card.
                  </Text>
                ) : null}
                {upiApps.map((app) => (
                  <Option
                    key={app.packageName}
                    title={app.name}
                    leading={<UpiIcon app={app} />}
                    selected={selection?.kind === "upi" && selection.app.packageName === app.packageName}
                    onPress={() => setSelection({ kind: "upi", app })}
                  />
                ))}
              </View>

              {banks.length > 0 ? (
                <>
                  <Text variant="label" muted style={styles.sectionTitle}>
                    Net banking
                  </Text>
                  <View style={styles.card} accessibilityRole="radiogroup">
                    {popularBanks.map((bank) => (
                      <Option
                        key={bank.code}
                        title={bank.name}
                        leading={<BankIcon code={bank.code} />}
                        selected={selection?.kind === "bank" && selection.bank.code === bank.code}
                        onPress={() => setSelection({ kind: "bank", bank })}
                      />
                    ))}
                    {selection?.kind === "bank" && !popularBanks.some((b) => b.code === selection.bank.code) ? (
                      <Option
                        title={selection.bank.name}
                        leading={<BankIcon code={selection.bank.code} />}
                        selected
                        onPress={() => setChoosingBank(true)}
                      />
                    ) : null}
                    <Option
                      chevron
                      title="All banks"
                      leading={<Icon name="business-outline" size={20} />}
                      onPress={() => setChoosingBank(true)}
                    />
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          <Text variant="label" muted style={styles.sectionTitle}>
            {showInApp ? "Credit or debit card" : "Pay securely"}
          </Text>
          <View style={styles.card}>
            <Option
              chevron
              title={showInApp ? "Pay by card" : "Open the secure payment page"}
              subtitle="Opens Glammzo's secure payment page"
              leading={<Icon name="card-outline" size={20} />}
              onPress={() => void openWebPage()}
            />
          </View>

          <Text variant="caption" muted style={styles.secure}>
            Secure payment by Razorpay
          </Text>
        </>
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  summaryCopy: { flex: 1, minWidth: 0, gap: 2 },
  amount: { fontSize: 32, lineHeight: 40, fontFamily: "Geist_700Bold", color: colors.text },
  hold: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: statusColors.warnBg,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  holdExpired: { backgroundColor: statusColors.dangerBg },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  empty: { padding: spacing.md },
  failed: { marginTop: spacing.lg, gap: spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  leave: { gap: spacing.md, paddingBottom: spacing.sm },
  backRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 44 },
  pressed: { backgroundColor: colors.muted },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  optionText: { flex: 1, minWidth: 0 },
  logo: { width: 28, height: 28, resizeMode: "contain" },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  secure: { textAlign: "center", marginTop: spacing.lg },
  footer: { gap: spacing.sm },
  notice: {
    backgroundColor: statusColors.infoBg,
    color: statusColors.infoFg,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
})
