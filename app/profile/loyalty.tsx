import { useCallback, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { GradientFill } from "@/components/home/GradientFill"
import { PastelIcon } from "@/components/profile/ProfileParts"
import { Card, HEADER_TINTS, MUTED, ProfileSubScreen, SectionLabel } from "@/components/profile/ProfileScreenParts"
import { pastels, sp } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { SkeletonBone } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import {
  getLoyaltySummary,
  LOYALTY_DISCOUNT_CAP_RUPEES,
  LOYALTY_VISITS_PER_FREE,
  type LoyaltySummary,
} from "@/lib/loyalty"
import { getAccessToken } from "@/lib/session"
import { fetchLoyalty } from "@/lib/wallet-api"
import { fontFamily } from "@/theme/tokens"

const STAMP_INK = "#8a3524"

export default function LoyaltyScreen() {
  const router = useRouter()
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(getLoyaltySummary())
  const [loading, setLoading] = useState(true)
  const stamps = Math.min(loyalty.stampsTowardNextFree, LOYALTY_VISITS_PER_FREE)
  const total = LOYALTY_VISITS_PER_FREE
  const cap = `₹${LOYALTY_DISCOUNT_CAP_RUPEES}`
  const ready = loyalty.freeServiceCredits > 0

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

  const steps: { icon: IconName; pastel: (typeof pastels)[keyof typeof pastels]; text: string }[] = [
    {
      icon: "checkmark-done-outline",
      pastel: pastels.mint,
      text: "Only completed services count. Cancelled or missed visits don't.",
    },
    { icon: "ribbon-outline", pastel: pastels.peach, text: `Every ${total} completed visits unlocks 1 loyalty credit.` },
    {
      icon: "pricetag-outline",
      pastel: pastels.gold,
      text: `Use a credit on a later booking for up to ${cap} off one service (free if it costs ${cap} or less).`,
    },
  ]

  const hero = loading ? null : (
    <View
      style={styles.hero}
      accessible
      accessibilityLabel={`${stamps} of ${total} stamps. ${ready ? "Free visit ready" : `${loyalty.visitsLeft} to go`}`}
    >
      <GradientFill colors={pastels.peach.gradient} angle={150} />
      <View style={styles.heroTop}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroLabel}>Stamp card</Text>
          <Text style={styles.heroCount}>
            {stamps}/{total}
          </Text>
        </View>
        <View style={[styles.statusPill, ready && styles.statusPillReady]}>
          <Text style={[styles.statusText, ready && styles.statusTextReady]}>
            {ready ? "Free visit ready" : `${loyalty.visitsLeft} to go`}
          </Text>
        </View>
      </View>
      <View style={styles.grid}>
        {Array.from({ length: total }).map((_, index) =>
          index < stamps ? (
            <View key={index} style={[styles.stamp, styles.stampFilled]}>
              <Icon name="checkmark" size={20} color="#ffffff" />
            </View>
          ) : (
            <View key={index} style={[styles.stamp, styles.stampEmpty]} />
          ),
        )}
      </View>
      <Text style={styles.heroText}>
        {loyalty.completedVisits} completed visit{loyalty.completedVisits === 1 ? "" : "s"}. Complete {total} services
        and get {cap} off any service.
      </Text>
    </View>
  )

  return (
    <ProfileSubScreen title="Loyalty rewards" subtitle="Collect a stamp every visit" tint={HEADER_TINTS.loyalty} hero={hero}>
      {loading ? (
        <View style={styles.skeleton} accessibilityLabel="Loading your stamp card">
          <SkeletonBone height={230} radius={16} />
          <SkeletonBone width={110} height={12} style={{ marginTop: 12 }} />
          <SkeletonBone height={190} radius={16} />
        </View>
      ) : (
        <>
          <SectionLabel>How it works</SectionLabel>
          <Card>
            {steps.map((step, index) => (
              <View key={step.text} style={styles.step}>
                <PastelIcon pastel={step.pastel} name={step.icon} />
                <View style={styles.stepText}>
                  <Text style={styles.stepNumber}>Step {index + 1}</Text>
                  <Text style={styles.stepLabel}>{step.text}</Text>
                </View>
              </View>
            ))}
          </Card>

          <SectionLabel>Credits ready</SectionLabel>
          <Card style={styles.creditsCard}>
            <PastelIcon pastel={ready ? pastels.mint : pastels.peach} name="gift-outline" />
            <View style={styles.stepText}>
              <Text style={styles.creditsValue}>{loyalty.freeServiceCredits}</Text>
              <Text style={styles.creditsText}>
                {ready
                  ? `You can apply a reward on your next booking (up to ${cap} off).`
                  : `Unlock your first credit after ${loyalty.visitsLeft} more completed visit${loyalty.visitsLeft === 1 ? "" : "s"}.`}
              </Text>
            </View>
          </Card>

          <Text style={styles.terms}>
            The credit applies on a later booking after you hit {total} completed visits. You get a free service if that
            service costs {cap} or less. Credits cannot be used on packages.
          </Text>
        </>
      )}
    </ProfileSubScreen>
  )
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16, overflow: "hidden", padding: 18, gap: 14 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  heroCopy: { gap: 2 },
  heroLabel: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18, color: STAMP_INK },
  heroCount: { fontFamily: fontFamily.bold, fontSize: 32, lineHeight: 38, color: sp.text },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "#ffffff" },
  statusPillReady: { backgroundColor: "#e6f5ec" },
  statusText: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, color: STAMP_INK },
  statusTextReady: { color: "#17633e" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  stamp: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  stampFilled: { backgroundColor: STAMP_INK },
  stampEmpty: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#d9a493",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  heroText: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: STAMP_INK },
  skeleton: { gap: 12 },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepText: { flex: 1, minWidth: 0, gap: 1 },
  stepNumber: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, color: sp.secondary },
  stepLabel: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: sp.text },
  creditsCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  creditsValue: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, color: sp.text },
  creditsText: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: sp.secondary },
  terms: {
    marginTop: 24,
    paddingHorizontal: 4,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
})
