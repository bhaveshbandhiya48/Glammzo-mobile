import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { Linking, StyleSheet, View } from "react-native"

import { Button } from "@/components/ui/Button"
import { Screen } from "@/components/ui/Screen"
import { ProfileBlockSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { fetchMyPackages, packagePayUrl, type MyPackage } from "@/lib/packages-api"
import { formatRupees } from "@/lib/service-pricing"
import { getAccessToken } from "@/lib/session"
import { colors, radii, spacing, status as tint } from "@/theme/tokens"

const STATUS: Record<MyPackage["status"], { label: string; fg: string; bg: string }> = {
  pending_payment: { label: "Not paid yet", fg: tint.warnFg, bg: tint.warnBg },
  active: { label: "Active", fg: tint.successFg, bg: tint.successBg },
  used: { label: "All used", fg: colors.textMuted, bg: colors.muted },
  expired: { label: "Expired", fg: colors.textMuted, bg: colors.muted },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export default function MyPackagesScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [packages, setPackages] = useState<MyPackage[]>([])

  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        if (!(await getAccessToken())) {
          router.replace({ pathname: "/login", params: { next: "/profile/packages" } })
          return
        }
        try {
          const next = await fetchMyPackages()
          if (active) setPackages(next)
        } catch {
          // Empty state covers it.
        } finally {
          if (active) setLoading(false)
        }
      })()
      return () => {
        active = false
      }
    }, [router]),
  )

  if (loading) {
    return (
      <Screen scroll>
        <ProfileBlockSkeleton />
      </Screen>
    )
  }

  return (
    <Screen scroll contentStyle={styles.screen}>
      <Text variant="title">My packages</Text>
      <Text muted>Prepaid sessions you can book any time in 12 months. They apply at checkout automatically.</Text>
      {packages.length === 0 ? (
        <View style={styles.card}>
          <Text variant="bodyStrong">No packages yet</Text>
          <Text variant="caption" muted>
            Look for &quot;Buy ahead&quot; on a salon&apos;s packages to prepay and save time at checkout.
          </Text>
          <Button label="Browse salons" variant="secondary" onPress={() => router.push("/(tabs)/explore")} />
        </View>
      ) : (
        packages.map((pkg) => {
          const tone = STATUS[pkg.status]
          return (
            <View key={pkg.id} style={styles.card}>
              <View style={styles.head}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="heading">{pkg.packageName}</Text>
                  <Text variant="caption" muted>
                    {pkg.salonName} · {formatRupees(pkg.priceRupees)}
                    {pkg.status === "active" && pkg.expiresAt ? ` · use by ${formatDate(pkg.expiresAt)}` : ""}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                  <Text variant="caption" color={tone.fg}>
                    {tone.label}
                  </Text>
                </View>
              </View>
              {pkg.sessions.map((s) => (
                <View key={s.serviceId} style={styles.session}>
                  <Text style={{ flex: 1 }}>{s.serviceName}</Text>
                  <Text variant="bodyStrong">
                    {s.left} of {s.total} left
                  </Text>
                </View>
              ))}
              {pkg.status === "pending_payment" && pkg.token ? (
                <Button label={`Pay ${formatRupees(pkg.priceRupees)}`} onPress={() => void Linking.openURL(packagePayUrl(pkg.token!))} />
              ) : pkg.status === "active" && pkg.salonSlug ? (
                <Button
                  label="Book a session"
                  onPress={() => router.push({ pathname: "/salon/[id]", params: { id: pkg.salonSlug } })}
                />
              ) : null}
            </View>
          )
        })
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  session: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
})
