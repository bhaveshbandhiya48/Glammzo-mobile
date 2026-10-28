import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { Linking, Pressable, StyleSheet, View } from "react-native"

import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Screen } from "@/components/ui/Screen"
import { ProfileBlockSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { CRM_URL } from "@/lib/config"
import { formatRupees } from "@/lib/service-pricing"
import { getAccessToken } from "@/lib/session"
import { createGiftCard, fetchGiftCards, type GiftCardSummary } from "@/lib/wallet-api"
import { colors, radii, spacing, status as tint } from "@/theme/tokens"

const AMOUNTS = [500, 1000, 2000, 5000]
const MIN = 500
const MAX = 10000

function payUrl(token: string) {
  return `${CRM_URL}/pay/gift/${encodeURIComponent(token)}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

const STATUS: Record<GiftCardSummary["status"], { label: string; fg: string; bg: string }> = {
  pending_payment: { label: "Not paid yet", fg: tint.warnFg, bg: tint.warnBg },
  active: { label: "Active", fg: tint.successFg, bg: tint.successBg },
  used: { label: "Used", fg: colors.textMuted, bg: colors.muted },
  expired: { label: "Expired", fg: colors.textMuted, bg: colors.muted },
}

export default function GiftCardsScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<GiftCardSummary[]>([])
  const [amount, setAmount] = useState<number>(1000)
  const [custom, setCustom] = useState("")
  const [phone, setPhone] = useState("")
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setCards(await fetchGiftCards())
    } catch {
      // List is optional; the form still works.
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        if (!(await getAccessToken())) {
          router.replace({ pathname: "/login", params: { next: "/profile/gift-cards" } })
          return
        }
        await load()
        if (active) setLoading(false)
      })()
      return () => {
        active = false
      }
    }, [load, router]),
  )

  const chosen = custom.trim() ? Number(custom.replace(/\D/g, "")) : amount
  const digits = phone.replace(/\D/g, "").slice(-10)
  const amountOk = Number.isFinite(chosen) && chosen >= MIN && chosen <= MAX
  const phoneOk = /^[6-9]\d{9}$/.test(digits)

  async function buy() {
    setBusy(true)
    setError(null)
    try {
      const token = await createGiftCard({ amountRupees: chosen, recipientPhone: digits, recipientName: name, message })
      await Linking.openURL(payUrl(token))
      setPhone("")
      setName("")
      setMessage("")
      setCustom("")
      void load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the gift card.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Screen scroll>
        <ProfileBlockSkeleton />
      </Screen>
    )
  }

  return (
    <Screen scroll keyboardAvoiding contentStyle={styles.screen}>
      <View style={styles.hero}>
        <Text variant="label" color={colors.accent}>
          Gift cards
        </Text>
        <Text variant="title" color={colors.primaryFg}>
          Give a beauty treat
        </Text>
        <Text variant="caption" color={colors.accent}>
          It goes straight into their Glammzo wallet. They can use it at any salon or artist for 12 months.
        </Text>
      </View>

      <View style={styles.card}>
        <Text variant="label" muted>
          Amount
        </Text>
        <View style={styles.amounts}>
          {AMOUNTS.map((value) => {
            const active = !custom.trim() && amount === value
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.amount, active && styles.amountActive]}
                onPress={() => {
                  setAmount(value)
                  setCustom("")
                }}
              >
                <Text variant="bodyStrong" color={active ? colors.primaryFg : colors.text}>
                  {formatRupees(value)}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <Input
          label="Or another amount (optional)"
          value={custom}
          onChangeText={setCustom}
          keyboardType="number-pad"
          placeholder="e.g. 1500"
          error={custom.trim() && !amountOk ? `Choose from ${formatRupees(MIN)} to ${formatRupees(MAX)}.` : null}
        />
        <Input
          label="Their mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="98765 43210"
          maxLength={14}
          hint="The money goes to the Glammzo wallet on this number."
          error={phone.trim() && digits.length >= 10 && !phoneOk ? "Enter a valid 10-digit mobile number." : null}
        />
        <Input label="Their name (optional)" value={name} onChangeText={setName} placeholder="e.g. Priya" maxLength={60} />
        <Input
          label="Message (optional)"
          value={message}
          onChangeText={setMessage}
          placeholder="Happy birthday! Treat yourself."
          maxLength={200}
          multiline
        />
        {error ? (
          <Text variant="caption" color={colors.destructive}>
            {error}
          </Text>
        ) : null}
        <Button
          label={amountOk ? `Pay ${formatRupees(chosen)}` : "Pay"}
          loading={busy}
          disabled={!amountOk || !phoneOk}
          onPress={() => void buy()}
        />
        <Text variant="caption" muted>
          You&apos;ll pay on Glammzo&apos;s secure page (UPI, card or net banking). Gift cards can&apos;t be refunded once paid.
        </Text>
      </View>

      {cards.length > 0 ? (
        <View style={styles.card}>
          <Text variant="label" muted>
            Your gift cards
          </Text>
          {cards.map((card) => {
            const tone = STATUS[card.status]
            const who = card.direction === "sent" ? `To ${card.otherName || `+91 ${card.otherPhone}`}` : "Received"
            return (
              <View key={card.id} style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">
                    {formatRupees(card.amountRupees)} · {who}
                  </Text>
                  <Text variant="caption" muted>
                    {card.status === "active" && card.expiresAt
                      ? `${formatRupees(card.remainingRupees)} left · valid until ${formatDate(card.expiresAt)}`
                      : formatDate(card.createdAt)}
                  </Text>
                </View>
                {card.status === "pending_payment" && card.token ? (
                  <Button label="Pay" variant="secondary" style={styles.payBtn} onPress={() => void Linking.openURL(payUrl(card.token!))} />
                ) : (
                  <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                    <Text variant="caption" color={tone.fg}>
                      {tone.label}
                    </Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    backgroundColor: colors.hero,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  amounts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  amount: {
    flexGrow: 1,
    minWidth: "22%",
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  amountActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  payBtn: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
  },
})
