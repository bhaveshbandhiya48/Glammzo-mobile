import { useCallback, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { Screen } from "@/components/ui/Screen"
import { ProfileBlockSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { getAccessToken } from "@/lib/session"
import { fetchWallet, type WalletLedgerEntry, walletReasonLabel } from "@/lib/wallet-api"
import { colors, radii, spacing } from "@/theme/tokens"

function formatLedgerAmount(deltaPaise: number) {
  const rupees = Math.round(Math.abs(deltaPaise) / 100)
  const sign = deltaPaise >= 0 ? "+" : "−"
  return `${sign}₹${rupees}`
}

function formatLedgerDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function WalletActivityScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        const token = await getAccessToken()
        if (!token) {
          router.replace({
            pathname: "/login",
            params: { next: "/profile/activity" },
          })
          return
        }
        setLoading(true)
        setError(null)
        try {
          const data = await fetchWallet()
          if (!active) return
          setLedger(data.ledger ?? [])
        } catch {
          if (!active) return
          setError("Could not load wallet activity.")
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
      <Text variant="title">Wallet activity</Text>
      <Text muted style={styles.gap}>
        Ledger of credits and redemptions.
      </Text>
      {loading ? (
        <ProfileBlockSkeleton />
      ) : error ? (
        <Text variant="caption" color={colors.primary} style={styles.gap}>
          {error}
        </Text>
      ) : ledger.length === 0 ? (
        <View style={[styles.row, styles.gap]}>
          <Text muted>No wallet activity yet.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {ledger.map((entry) => (
            <View key={entry.id} style={styles.row}>
              <View style={styles.copy}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {walletReasonLabel(entry.reason)}
                </Text>
                <Text variant="caption" muted>
                  {formatLedgerDate(entry.createdAt)}
                </Text>
              </View>
              <Text
                variant="bodyStrong"
                color={entry.deltaPaise >= 0 ? colors.success : colors.text}
              >
                {formatLedgerAmount(entry.deltaPaise)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  gap: {
    marginTop: spacing.sm,
  },
  list: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
})
