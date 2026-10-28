import { formatRupees } from "@/lib/service-pricing"
import { useCallback, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { Screen } from "@/components/ui/Screen"
import { ProfileBlockSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { getAccessToken } from "@/lib/session"
import { fetchWallet, walletReasonLabel, type WalletLedgerEntry } from "@/lib/wallet-api"
import { colors, radii, spacing } from "@/theme/tokens"

export default function WalletScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [balanceRupees, setBalanceRupees] = useState(0)
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([])
  const [campaignTitle, setCampaignTitle] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        const token = await getAccessToken()
        if (!token) {
          router.replace({ pathname: "/login", params: { next: "/profile/wallet" } })
          return
        }
        setLoading(true)
        setError(null)
        try {
          const data = await fetchWallet()
          if (!active) return
          setBalanceRupees(data.wallet?.balanceRupees ?? 0)
          setLedger(data.ledger ?? [])
          setCampaignTitle(data.campaign?.active ? data.campaign.title : null)
        } catch {
          if (!active) return
          setError("Could not load wallet. Sign in again if this persists.")
        } finally {
          if (active) setLoading(false)
        }
      })()
      return () => {
        active = false
      }
    }, [router]),
  )

  return (
    <Screen scroll>
      <Text variant="label" muted>
        Balance
      </Text>
      {loading ? (
        <ProfileBlockSkeleton />
      ) : (
        <>
          <Text variant="title" style={styles.gap}>
            {formatRupees(balanceRupees)}
          </Text>
          <Text muted style={styles.gap}>
            Wallet credit applies at checkout when you toggle Apply on booking.
          </Text>
          {error ? (
            <Text variant="caption" color={colors.primary} style={styles.gap}>
              {error}
            </Text>
          ) : null}
          {campaignTitle ? (
            <View style={styles.card}>
              <Text variant="bodyStrong">{campaignTitle}</Text>
              <Text muted>Welcome credit campaign is active on staging.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text variant="bodyStrong">Wallet</Text>
              <Text muted>Credits appear here after eligible bookings and promos.</Text>
            </View>
          )}
          {ledger.length > 0 ? (
            <View style={styles.card}>
              <Text variant="bodyStrong">Recent activity</Text>
              {ledger.slice(0, 8).map((entry) => (
                <View key={entry.id} style={styles.ledgerRow}>
                  <Text style={{ flex: 1 }}>{walletReasonLabel(entry.reason)}</Text>
                  <Text variant="bodyStrong">
                    {entry.deltaPaise >= 0 ? "+" : ""}
                    ₹{(entry.deltaPaise / 100).toFixed(0)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  gap: {
    marginTop: spacing.sm,
  },
  card: {
    marginTop: spacing.xxxl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
})
