import { useCallback, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { Button } from "@/components/ui/Button"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Screen } from "@/components/ui/Screen"
import { Text } from "@/components/ui/Text"
import { fetchMe } from "@/lib/auth-api"
import { ApiError } from "@/lib/api"
import { getAccessToken } from "@/lib/session"
import { LOYALTY_VISITS_PER_FREE, type LoyaltySummary } from "@/lib/loyalty"
import { clearLocalSession, getDisplayName } from "@/lib/user"
import { fetchLoyalty, fetchWallet } from "@/lib/wallet-api"
import { colors, radii, spacing } from "@/theme/tokens"

const HUB_ROWS: {
  label: string
  href:
    | "/profile/details"
    | "/profile/favorites"
    | "/profile/wallet"
    | "/profile/loyalty"
    | "/profile/activity"
  icon: IconName
}[] = [
  { label: "Your profile", href: "/profile/details", icon: "person-outline" },
  { label: "Saved", href: "/profile/favorites", icon: "heart-outline" },
  { label: "Wallet", href: "/profile/wallet", icon: "wallet-outline" },
  { label: "Loyalty rewards", href: "/profile/loyalty", icon: "ribbon-outline" },
  { label: "Wallet activity", href: "/profile/activity", icon: "receipt-outline" },
]

export default function ProfileScreen() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [name, setName] = useState("Guest")
  const [walletRupees, setWalletRupees] = useState<number | null>(null)
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      setReady(false)
      ;(async () => {
        const [value, displayName] = await Promise.all([
          getAccessToken(),
          getDisplayName(),
        ])
        if (!active) return
        if (!value) {
          router.replace({
            pathname: "/login",
            params: { next: "/(tabs)/profile" },
          })
          return
        }
        try {
          await fetchMe()
        } catch (error) {
          if (!active) return
          if (error instanceof ApiError && error.status === 401) {
            router.replace({
              pathname: "/login",
              params: { next: "/(tabs)/profile" },
            })
            return
          }
        }
        if (!active) return
        setName(displayName)
        try {
          const [wallet, loyaltyNext] = await Promise.all([
            fetchWallet(),
            fetchLoyalty(),
          ])
          if (!active) return
          setWalletRupees(wallet.wallet?.balanceRupees ?? 0)
          setLoyalty(loyaltyNext)
        } catch {
          if (!active) return
          setWalletRupees(null)
          setLoyalty(null)
        } finally {
          if (active) setReady(true)
        }
      })()
      return () => {
        active = false
      }
    }, [router]),
  )

  if (!ready) {
    return (
      <Screen edges={["top", "left", "right"]} contentStyle={styles.loading}>
        <ActivityIndicator color={colors.coral} />
      </Screen>
    )
  }

  return (
    <Screen scroll edges={["top", "left", "right"]} contentStyle={styles.screen}>
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text variant="heading" color={colors.primaryFg}>
            {name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerCopy}>
          <Text variant="heading">{name}</Text>
          <Text variant="caption" muted>
            Signed in with mobile
          </Text>
        </View>
      </View>

      <View style={styles.tileRow}>
        <Pressable style={styles.tile} onPress={() => router.push("/profile/wallet")}>
          <Icon name="wallet-outline" size={20} color={colors.coral} />
          <Text variant="caption" muted>
            Wallet
          </Text>
          <Text variant="bodyStrong">
            {walletRupees == null ? "—" : `₹${Math.round(walletRupees)}`}
          </Text>
        </Pressable>
        <Pressable style={styles.tile} onPress={() => router.push("/profile/loyalty")}>
          <Icon name="ribbon-outline" size={20} color={colors.coral} />
          <Text variant="caption" muted>
            Loyalty
          </Text>
          <Text variant="bodyStrong">
            {loyalty
              ? `${loyalty.stampsTowardNextFree} / ${LOYALTY_VISITS_PER_FREE}`
              : "—"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {HUB_ROWS.map((row) => (
          <Pressable
            key={row.href}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push(row.href)}
          >
            <View style={styles.rowLeft}>
              <View style={styles.rowIcon}>
                <Icon name={row.icon} size={18} color={colors.text} />
              </View>
              <Text variant="bodyStrong">{row.label}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        ))}
      </View>

      <View style={[styles.list, styles.supportList]}>
        <Pressable
          style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.pressed]}
          onPress={() => router.push("/profile/support")}
        >
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}>
              <Icon name="help-circle-outline" size={18} color={colors.text} />
            </View>
            <Text variant="bodyStrong">Help & support</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.textSubtle} />
        </Pressable>
      </View>

      <Button
        label="Logout"
        variant="secondary"
        style={{ marginTop: spacing.xxl }}
        onPress={async () => {
          await clearLocalSession()
          setWalletRupees(null)
          setLoyalty(null)
          setReady(false)
          router.replace({
            pathname: "/login",
            params: { next: "/(tabs)/profile" },
          })
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: spacing.xl,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  tileRow: {
    marginTop: spacing.xl,
    flexDirection: "row",
    gap: spacing.md,
  },
  tile: {
    flex: 1,
    gap: 4,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  list: {
    marginTop: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  supportList: {
    marginTop: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.muted,
  },
})
