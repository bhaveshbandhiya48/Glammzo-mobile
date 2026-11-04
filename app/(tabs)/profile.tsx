import { formatRupees } from "@/lib/service-pricing"
import { useCallback, useState } from "react"
import Constants from "expo-constants"
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { Button } from "@/components/ui/Button"
import { useFloatingTabBarSpace } from "@/components/ui/FloatingTabBar"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Screen } from "@/components/ui/Screen"
import { Text } from "@/components/ui/Text"
import { fetchMe } from "@/lib/auth-api"
import { ApiError } from "@/lib/api"
import { getAccessToken } from "@/lib/session"
import { LOYALTY_VISITS_PER_FREE, type LoyaltySummary } from "@/lib/loyalty"
import { LEGAL } from "@/lib/legal"
import { clearLocalSession, getConsumerProfile, getDisplayName } from "@/lib/user"
import { fetchLoyalty, fetchWallet } from "@/lib/wallet-api"
import { colors, radii, spacing } from "@/theme/tokens"

type HubRow = {
  label: string
  icon: IconName
  /** In-app screen, an external page, or a custom action. */
  href?:
    | "/profile/details"
    | "/profile/favorites"
    | "/profile/wallet"
    | "/profile/loyalty"
    | "/profile/activity"
    | "/profile/support"
    | "/profile/refer"
    | "/profile/gift-cards"
  url?: string
  action?: () => void
  hint?: string
}

const SECTIONS: { title: string; rows: HubRow[] }[] = [
  {
    title: "Account",
    rows: [
      { label: "Your profile", href: "/profile/details", icon: "person-outline" },
      { label: "Saved salons and artists", href: "/profile/favorites", icon: "heart-outline" },
    ],
  },
  {
    title: "Money and rewards",
    rows: [
      { label: "Wallet", href: "/profile/wallet", icon: "wallet-outline" },
      { label: "Wallet activity", href: "/profile/activity", icon: "receipt-outline" },
      { label: "Loyalty rewards", href: "/profile/loyalty", icon: "ribbon-outline" },
      { label: "Gift cards", href: "/profile/gift-cards", icon: "card-outline" },
      { label: "Refer a friend · get ₹199", href: "/profile/refer", icon: "gift-outline" },
    ],
  },
  {
    title: "Help and settings",
    rows: [
      { label: "Help & support", href: "/profile/support", icon: "help-circle-outline" },
      {
        label: "Notification settings",
        icon: "notifications-outline",
        hint: "Opens your phone's settings for Glammzo",
        action: () => void Linking.openSettings(),
      },
    ],
  },
  {
    title: "Legal",
    rows: [
      { label: "Terms of service", url: LEGAL.termsUrl, icon: "document-text-outline" },
      { label: "Privacy policy", url: LEGAL.privacyUrl, icon: "shield-checkmark-outline" },
      { label: "Cancellation policy", url: LEGAL.cancellationUrl, icon: "close-circle-outline" },
    ],
  },
]

const APP_VERSION = Constants.expoConfig?.version?.trim() || ""

export default function ProfileScreen() {
  const tabBarSpace = useFloatingTabBarSpace()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [name, setName] = useState("Guest")
  const [phone, setPhone] = useState("")
  const [walletRupees, setWalletRupees] = useState<number | null>(null)
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      // Keep the scrolled hub mounted on return — only refresh data in place.
      ;(async () => {
        const [value, displayName] = await Promise.all([
          getAccessToken(),
          getDisplayName(),
        ])
        if (!active) return
        if (!value) {
          setReady(false)
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
            setReady(false)
            router.replace({
              pathname: "/login",
              params: { next: "/(tabs)/profile" },
            })
            return
          }
        }
        if (!active) return
        setName(displayName)
        void getConsumerProfile().then((profile) => {
          if (active) setPhone(profile.phone)
        })
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
        <ActivityIndicator color={colors.primary} />
      </Screen>
    )
  }

  return (
    <Screen
      scroll
      edges={["top", "left", "right"]}
      contentStyle={[styles.screen, { paddingBottom: tabBarSpace }]}
    >
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text variant="heading" color={colors.primary}>
            {name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerCopy}>
          <Text variant="heading" color={colors.primaryFg}>
            {name}
          </Text>
          <Text variant="caption" color={colors.accent}>
            {formatPhone(phone) || "Signed in with mobile"}
          </Text>
        </View>
      </View>

      <View style={styles.tileRow}>
        <Pressable accessibilityRole="button" style={styles.tile} onPress={() => router.push("/profile/wallet")}>
          <Icon name="wallet-outline" size={20} color={colors.primary} />
          <Text variant="caption" muted>
            Wallet
          </Text>
          <Text variant="bodyStrong">
            {walletRupees == null ? "—" : `${formatRupees(walletRupees)}`}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.tile} onPress={() => router.push("/profile/loyalty")}>
          <Icon name="ribbon-outline" size={20} color={colors.primary} />
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

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text variant="label" muted style={styles.sectionTitle}>
            {section.title}
          </Text>
          <View style={styles.list}>
            {section.rows.map((row, index) => (
              <Pressable
                accessibilityRole={row.url ? "link" : "button"}
                accessibilityHint={row.hint ?? (row.url ? "Opens in your browser" : undefined)}
                key={row.label}
                style={({ pressed }) => [
                  styles.row,
                  index === section.rows.length - 1 && styles.rowLast,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  if (row.href) router.push(row.href)
                  else if (row.url) void Linking.openURL(row.url)
                  else row.action?.()
                }}
              >
                <View style={styles.rowLeft}>
                  <View style={styles.rowIcon}>
                    <Icon name={row.icon} size={18} color={colors.text} />
                  </View>
                  <Text variant="bodyStrong">{row.label}</Text>
                </View>
                <Icon
                  name={row.url ? "open-outline" : "chevron-forward"}
                  size={18}
                  color={colors.textSubtle}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Button
        label="Log out"
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
      {APP_VERSION ? (
        <Text variant="caption" muted style={styles.version}>
          Glammzo {APP_VERSION}
        </Text>
      ) : null}
    </Screen>
  )
}

/** "+918758431673" → "+91 87584 31673". */
function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(-10)
  if (digits.length !== 10) return raw
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionTitle: {
    paddingHorizontal: spacing.xs,
  },
  version: {
    textAlign: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
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
    backgroundColor: colors.hero,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
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
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface,
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
