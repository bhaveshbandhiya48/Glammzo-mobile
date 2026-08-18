import { useCallback, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { Screen } from "@/components/ui/Screen"
import { ProfileBlockSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import {
  getLoyaltySummary,
  LOYALTY_DISCOUNT_CAP_RUPEES,
  LOYALTY_VISITS_PER_FREE,
  type LoyaltySummary,
} from "@/lib/loyalty"
import { getAccessToken } from "@/lib/session"
import { fetchLoyalty } from "@/lib/wallet-api"
import { colors, radii, spacing } from "@/theme/tokens"

export default function LoyaltyScreen() {
  const router = useRouter()
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(getLoyaltySummary())
  const [loading, setLoading] = useState(true)
  const stamps = loyalty.stampsTowardNextFree
  const total = LOYALTY_VISITS_PER_FREE
  const cap = `₹${LOYALTY_DISCOUNT_CAP_RUPEES}`

  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        const token = await getAccessToken()
        if (!token) {
          router.replace({ pathname: "/login", params: { next: "/profile/loyalty" } })
          return
        }
        setLoading(true)
        try {
          const next = await fetchLoyalty()
          if (active) setLoyalty(next)
        } catch {
          if (active) setLoyalty(getLoyaltySummary())
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
        Your reward
      </Text>
      <Text variant="title" style={styles.gap}>
        Complete {total} services and get {cap} off any service
      </Text>
      <Text muted style={styles.gap}>
        Or get a free service if that service costs {cap} or less. The credit applies on a
        later booking after you hit {total} completed visits.
      </Text>

      {loading ? (
        <ProfileBlockSkeleton />
      ) : (
        <>
          <View style={styles.card}>
            <Text variant="label" muted>
              Progress
            </Text>
            <Text variant="heading" style={styles.gap}>
              {stamps}/{total}
            </Text>
            <Text muted>
              {loyalty.completedVisits} completed visit
              {loyalty.completedVisits === 1 ? "" : "s"}
              {loyalty.freeServiceCredits > 0
                ? ` · ready for your next ${cap} reward cycle`
                : ` · ${loyalty.visitsLeft} more to unlock ${cap} off`}
            </Text>
            <View style={styles.grid}>
              {Array.from({ length: total }).map((_, index) => (
                <View
                  key={index}
                  style={[styles.stamp, index < stamps && styles.stampFilled]}
                />
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text variant="label" muted>
              How it works
            </Text>
            <Text style={styles.rule}>
              1. Only completed services count — cancelled or missed visits do not.
            </Text>
            <Text style={styles.rule}>
              2. Every {total} completed visits unlocks 1 loyalty credit.
            </Text>
            <Text style={styles.rule}>
              3. Use a credit on a later booking for up to {cap} off one service (free if that
              service costs {cap} or less).
            </Text>
            <Text style={styles.rule}>
              4. Credits cannot be used on packages.
            </Text>
          </View>

          <View style={styles.card}>
            <Text variant="label" muted>
              Loyalty credits ready
            </Text>
            <Text variant="heading" style={styles.gap}>
              {loyalty.freeServiceCredits}
            </Text>
            <Text muted>
              {loyalty.freeServiceCredits > 0
                ? `You can apply a reward on your next booking (up to ${cap} off).`
                : `Keep booking — unlock your first credit after ${loyalty.visitsLeft} more completed visit${loyalty.visitsLeft === 1 ? "" : "s"}.`}
            </Text>
          </View>
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
    marginTop: spacing.xl,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  grid: {
    marginTop: spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  stamp: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stampFilled: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
  rule: {
    marginTop: spacing.sm,
  },
})
