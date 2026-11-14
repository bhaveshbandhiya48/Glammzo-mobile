import { useCallback, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { GradientFill } from "@/components/home/GradientFill"
import { PastelIcon, type Pastel } from "@/components/profile/ProfileParts"
import {
  Card,
  EmptyState,
  ErrorCard,
  HEADER_TINTS,
  ProfileSubScreen,
  SectionLabel,
  monthLabel,
} from "@/components/profile/ProfileScreenParts"
import { pastels, sp } from "@/components/salon-page/theme"
import type { IconName } from "@/components/ui/Icon"
import { SkeletonBone } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { formatRupees } from "@/lib/service-pricing"
import { getAccessToken } from "@/lib/session"
import { fetchWallet, type WalletLedgerEntry, walletReasonLabel } from "@/lib/wallet-api"
import { fontFamily } from "@/theme/tokens"

const CREDIT_GREEN = "#17633e"
const GREEN: Pastel = { gradient: ["#e6f5ec", "#d3f0e2"], ink: CREDIT_GREEN }
const GREY: Pastel = { gradient: ["#f2f2f2", "#e9e9e9"], ink: "#595959" }

function formatLedgerAmount(deltaPaise: number) {
  const sign = deltaPaise >= 0 ? "+" : "−"
  return `${sign}${formatRupees(Math.round(Math.abs(deltaPaise) / 100))}`
}

function formatLedgerDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

/** Icon and pastel by kind of entry: cashback, referral, refund, other credit, or money out. */
function entryLook(entry: WalletLedgerEntry): { icon: IconName; pastel: Pastel } {
  if (entry.deltaPaise < 0) return { icon: "arrow-up", pastel: GREY }
  if (entry.reason.startsWith("cashback")) return { icon: "sparkles-outline", pastel: pastels.peach }
  if (entry.reason === "referral_reward") return { icon: "people-outline", pastel: pastels.gold }
  if (entry.reason === "wallet_restore") return { icon: "refresh-outline", pastel: pastels.mint }
  return { icon: "arrow-down", pastel: GREEN }
}

/** Ledger split into month groups, keeping the order the API sends. */
function groupByMonth(ledger: WalletLedgerEntry[]) {
  const groups: { label: string; entries: WalletLedgerEntry[] }[] = []
  for (const entry of ledger) {
    const label = monthLabel(entry.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.entries.push(entry)
    else groups.push({ label, entries: [entry] })
  }
  return groups
}

export default function WalletActivityScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([])
  const [balanceRupees, setBalanceRupees] = useState(0)
  const [campaignTitle, setCampaignTitle] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (isActive: () => boolean = () => true) => {
      const token = await getAccessToken()
      if (!token) {
        router.replace({ pathname: "/login", params: { next: "/profile/activity" } })
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await fetchWallet()
        if (!isActive()) return
        setLedger(data.ledger ?? [])
        setBalanceRupees(data.wallet?.balanceRupees ?? 0)
        setCampaignTitle(data.campaign?.active ? data.campaign.title : null)
      } catch {
        if (!isActive()) return
        setError("Could not load wallet activity.")
      } finally {
        if (isActive()) setLoading(false)
      }
    },
    [router],
  )

  useFocusEffect(
    useCallback(() => {
      let active = true
      void load(() => active)
      return () => {
        active = false
      }
    }, [load]),
  )

  const hero =
    loading || error ? null : (
      <View style={styles.hero} accessible accessibilityLabel={`Wallet balance ${formatRupees(balanceRupees)}`}>
        <GradientFill colors={pastels.mint.gradient} angle={150} />
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>Balance</Text>
          <PastelIcon pastel={{ gradient: ["#ffffff", "#ffffff"], ink: pastels.mint.ink }} name="wallet-outline" />
        </View>
        <Text style={styles.heroAmount}>{formatRupees(balanceRupees)}</Text>
        <Text style={styles.heroText}>Use it at checkout by turning on wallet credit when you book.</Text>
        {campaignTitle ? (
          <View style={styles.campaign}>
            <Text style={styles.campaignText} numberOfLines={2}>
              {campaignTitle}
            </Text>
          </View>
        ) : null}
      </View>
    )

  let body
  if (loading) {
    body = (
      <View style={styles.skeleton} accessibilityLabel="Loading wallet activity">
        <SkeletonBone height={150} radius={16} />
        <SkeletonBone width={110} height={12} style={{ marginTop: 12 }} />
        <SkeletonBone height={220} radius={16} />
      </View>
    )
  } else if (error) {
    body = <ErrorCard title="Couldn't load your wallet" text={error} onRetry={() => void load()} />
  } else if (ledger.length === 0) {
    body = (
      <EmptyState
        pastel={pastels.mint}
        icon="receipt-outline"
        title="No wallet activity yet"
        text="Cashback, rewards and refunds show up here."
      />
    )
  } else {
    body = groupByMonth(ledger).map((group, groupIndex) => (
      <View key={group.label}>
        <SectionLabel first={groupIndex === 0}>{group.label}</SectionLabel>
        <Card style={styles.listCard}>
          {group.entries.map((entry, index) => {
            const look = entryLook(entry)
            const credit = entry.deltaPaise >= 0
            const title = walletReasonLabel(entry.reason)
            const amount = formatLedgerAmount(entry.deltaPaise)
            const date = formatLedgerDate(entry.createdAt)
            return (
              <View
                key={entry.id}
                style={styles.row}
                accessible
                accessibilityLabel={`${title}, ${date}, ${credit ? "added" : "used"} ${amount.slice(1)}`}
              >
                {index > 0 ? <View style={styles.hairline} /> : null}
                <PastelIcon pastel={look.pastel} name={look.icon} />
                <View style={styles.copy}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {title}
                  </Text>
                  <Text style={styles.rowDate}>{date}</Text>
                </View>
                <Text style={[styles.amount, { color: credit ? CREDIT_GREEN : sp.text }]}>{amount}</Text>
              </View>
            )
          })}
        </Card>
      </View>
    ))
  }

  return (
    <ProfileSubScreen title="Wallet" subtitle="Credits and redemptions" tint={HEADER_TINTS.wallet} hero={hero}>
      {body}
    </ProfileSubScreen>
  )
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16, overflow: "hidden", padding: 18, gap: 6 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLabel: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18, color: pastels.mint.ink },
  heroAmount: { fontFamily: fontFamily.bold, fontSize: 36, lineHeight: 42, color: sp.text },
  heroText: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: pastels.mint.ink },
  campaign: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
  campaignText: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, color: CREDIT_GREEN },
  skeleton: { gap: 12 },
  listCard: { padding: 0, gap: 0, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  hairline: {
    position: "absolute",
    top: 0,
    left: 62,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: sp.border,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 20, color: sp.text },
  rowDate: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: sp.secondary },
  amount: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, textAlign: "right" },
})
