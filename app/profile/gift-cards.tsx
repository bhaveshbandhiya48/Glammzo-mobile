import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { Linking, Pressable, StyleSheet, View } from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import {
  Card,
  Field,
  HEADER_TINTS,
  MUTED,
  PrimaryPill,
  ProfileSubScreen,
  SectionLabel,
  StatusPill,
  type PillTone,
} from "@/components/profile/ProfileScreenParts"
import { PACKAGE_PASTELS, pastels, sp, ui } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { SkeletonBone } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { CRM_URL } from "@/lib/config"
import { formatRupees } from "@/lib/service-pricing"
import { getAccessToken } from "@/lib/session"
import { createGiftCard, fetchGiftCards, type GiftCardSummary } from "@/lib/wallet-api"
import { fontFamily } from "@/theme/tokens"

const AMOUNTS = [500, 1000, 2000, 5000]
const MIN = 500
const MAX = 10000
const GREY_CARD = ["#f6f6f6", "#e9e9e9"]

function payUrl(token: string) {
  return `${CRM_URL}/pay/gift/${encodeURIComponent(token)}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

const STATUS: Record<GiftCardSummary["status"], { label: string; tone: PillTone }> = {
  pending_payment: { label: "Not paid yet", tone: "peach" },
  active: { label: "Active", tone: "green" },
  used: { label: "Used", tone: "grey" },
  expired: { label: "Expired", tone: "grey" },
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

  const hero = (
    <View style={styles.hero}>
      <GradientFill colors={pastels.lavender.gradient} angle={150} />
      <View style={styles.heroText}>
        <Text style={styles.heroTitle}>Give a beauty treat</Text>
        <Text style={styles.heroSubtitle}>
          It goes straight into their Glammzo wallet. They can use it at any salon or artist for 12 months.
        </Text>
      </View>
      <View style={styles.heroIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="gift-outline" size={30} color={pastels.lavender.ink} />
      </View>
    </View>
  )

  if (loading) {
    return (
      <ProfileSubScreen title="Gift cards" tint={HEADER_TINTS.giftCards}>
        <View style={styles.skeleton} accessibilityLabel="Loading gift cards">
          <SkeletonBone height={110} radius={16} />
          <SkeletonBone width={110} height={12} style={{ marginTop: 12 }} />
          <SkeletonBone height={360} radius={16} />
        </View>
      </ProfileSubScreen>
    )
  }

  return (
    <ProfileSubScreen title="Gift cards" tint={HEADER_TINTS.giftCards} hero={hero} keyboard>
      {cards.length > 0 ? (
        <>
          <SectionLabel first>Your gift cards</SectionLabel>
          <View style={styles.cards}>
            {cards.map((card, index) => {
              const status = STATUS[card.status]
              const faded = card.status === "used" || card.status === "expired"
              const pastel = PACKAGE_PASTELS[index % PACKAGE_PASTELS.length]!
              const who = card.direction === "sent" ? `To ${card.otherName || `+91 ${card.otherPhone}`}` : "Received"
              const detail =
                card.status === "active" && card.expiresAt
                  ? `${formatRupees(card.remainingRupees)} left · valid until ${formatDate(card.expiresAt)}`
                  : formatDate(card.createdAt)
              return (
                <View key={card.id} style={styles.giftCard}>
                  <GradientFill colors={faded ? GREY_CARD : pastel.gradient} angle={150} />
                  <View style={styles.giftTop}>
                    <Text style={styles.giftWho} numberOfLines={1}>
                      {who}
                    </Text>
                    <StatusPill tone={status.tone} label={status.label} />
                  </View>
                  <Text style={styles.giftAmount}>{formatRupees(card.amountRupees)}</Text>
                  <View style={styles.giftBottom}>
                    <Text style={styles.giftDetail} numberOfLines={2}>
                      {detail}
                    </Text>
                    {card.status === "pending_payment" && card.token ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Pay ${formatRupees(card.amountRupees)} for this gift card`}
                        onPress={() => void Linking.openURL(payUrl(card.token!))}
                        style={({ pressed }) => [ui.blackPill, styles.payPill, pressed && ui.pressed]}
                      >
                        <Text style={ui.blackPillText}>Pay</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              )
            })}
          </View>
        </>
      ) : null}

      <SectionLabel first={cards.length === 0}>Send a gift card</SectionLabel>
      <Card>
        <Text style={styles.fieldLabel}>Amount</Text>
        <View style={styles.amounts}>
          {AMOUNTS.map((value) => {
            const active = !custom.trim() && amount === value
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [ui.chip, styles.amount, active && ui.chipActive, pressed && ui.pressed]}
                onPress={() => {
                  setAmount(value)
                  setCustom("")
                }}
              >
                <Text style={[ui.chipText, active && ui.chipTextActive]}>{formatRupees(value)}</Text>
              </Pressable>
            )
          })}
        </View>
        <Field
          label="Or another amount (optional)"
          value={custom}
          onChangeText={setCustom}
          keyboardType="number-pad"
          placeholder="e.g. 1500"
          error={custom.trim() && !amountOk ? `Choose from ${formatRupees(MIN)} to ${formatRupees(MAX)}.` : null}
        />
        <Field
          label="Their mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="98765 43210"
          maxLength={14}
          hint="The money goes to the Glammzo wallet on this number."
          error={phone.trim() && digits.length >= 10 && !phoneOk ? "Enter a valid 10-digit mobile number." : null}
        />
        <Field label="Their name (optional)" value={name} onChangeText={setName} placeholder="e.g. Priya" maxLength={60} />
        <Field
          label="Message (optional)"
          value={message}
          onChangeText={setMessage}
          placeholder="Happy birthday! Treat yourself."
          maxLength={200}
          multiline
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryPill
          label={amountOk ? `Pay ${formatRupees(chosen)}` : "Pay"}
          loading={busy}
          disabled={!amountOk || !phoneOk}
          onPress={() => void buy()}
        />
        <Text style={styles.note}>
          You&apos;ll pay on Glammzo&apos;s secure page (UPI, card or net banking). Gift cards can&apos;t be refunded once
          paid.
        </Text>
      </Card>
    </ProfileSubScreen>
  )
}

const styles = StyleSheet.create({
  skeleton: { gap: 12 },
  hero: { borderRadius: 16, overflow: "hidden", padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  heroText: { flex: 1, minWidth: 0, gap: 4 },
  heroTitle: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, color: sp.text },
  heroSubtitle: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: pastels.lavender.ink },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  cards: { gap: 12 },
  giftCard: { borderRadius: 16, overflow: "hidden", padding: 16, gap: 6 },
  giftTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  giftWho: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18, color: sp.text },
  giftAmount: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34, color: sp.text },
  giftBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  giftDetail: { flex: 1, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: sp.secondary },
  payPill: { paddingHorizontal: 18 },
  fieldLabel: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 17, color: sp.text, marginBottom: -6 },
  amounts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amount: { height: 36, flexGrow: 1, minWidth: "22%" },
  error: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: "#c0392b" },
  note: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: MUTED },
})
