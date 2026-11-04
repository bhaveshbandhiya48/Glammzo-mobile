import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { Share, StyleSheet, View } from "react-native"

import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Screen } from "@/components/ui/Screen"
import { ProfileBlockSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { LEGAL } from "@/lib/legal"
import { formatRupees } from "@/lib/service-pricing"
import { getAccessToken } from "@/lib/session"
import { claimReferral, fetchReferral, type ReferralSummary } from "@/lib/wallet-api"
import { colors, radii, spacing } from "@/theme/tokens"

const STEPS = [
  "Share your code with a friend who hasn't booked on Glammzo yet.",
  "They enter it under Profile → Refer a friend before their first visit.",
  "When their first visit is completed, you both get the credit in your wallet.",
]

export default function ReferScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [referral, setReferral] = useState<ReferralSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        if (!(await getAccessToken())) {
          router.replace({ pathname: "/login", params: { next: "/profile/refer" } })
          return
        }
        setLoading(true)
        try {
          const next = await fetchReferral()
          if (active) setReferral(next)
        } catch {
          if (active) setError("Couldn't load your referral code. Pull down or try again soon.")
        } finally {
          if (active) setLoading(false)
        }
      })()
      return () => {
        active = false
      }
    }, [router]),
  )

  const reward = formatRupees(referral?.rewardRupees ?? 199)

  async function share() {
    if (!referral?.code) return
    await Share.share({
      message: `Book salons and beauty artists on Glammzo. Use my code ${referral.code} and we both get ${reward} in our Glammzo wallet after your first visit. ${LEGAL.siteUrl}`,
    })
  }

  async function claim() {
    setClaiming(true)
    setClaimError(null)
    try {
      setReferral(await claimReferral(code))
      setCode("")
    } catch (err) {
      setClaimError(err instanceof ApiError ? err.message : "Couldn't apply the code.")
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <Screen scroll>
        <ProfileBlockSkeleton />
      </Screen>
    )
  }

  if (error || !referral?.code) {
    return (
      <Screen scroll>
        <Text variant="heading">Refer a friend</Text>
        <Text muted style={{ marginTop: spacing.sm }}>
          {error ??
            "Couldn't load your referral code right now. Please try again in a moment."}
        </Text>
      </Screen>
    )
  }

  return (
    <Screen scroll contentStyle={styles.screen}>
      <View style={styles.hero}>
        <Text variant="label" color={colors.accent}>
          Refer a friend
        </Text>
        <Text variant="title" color={colors.primaryFg}>
          You both get {reward}
        </Text>
        <Text variant="caption" color={colors.accent}>
          Wallet credit for you and your friend after their first completed visit.
        </Text>
        <View style={styles.codeBox} accessible accessibilityLabel={`Your code ${referral.code.split("").join(" ")}`}>
          <Text variant="caption" muted>
            Your code
          </Text>
          <Text variant="title" style={styles.code}>
            {referral.code}
          </Text>
        </View>
        <Button label="Share your code" variant="secondary" onPress={() => void share()} />
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text variant="heading">{referral.invited}</Text>
          <Text variant="caption" muted>
            Friends joined
          </Text>
        </View>
        <View style={styles.stat}>
          <Text variant="heading">{referral.rewarded}</Text>
          <Text variant="caption" muted>
            Completed a visit
          </Text>
        </View>
        <View style={styles.stat}>
          <Text variant="heading">{formatRupees(referral.earnedRupees)}</Text>
          <Text variant="caption" muted>
            Earned
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text variant="label" muted>
          How it works
        </Text>
        {STEPS.map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={styles.stepIndex}>
              <Text variant="caption" color={colors.primaryFg}>
                {index + 1}
              </Text>
            </View>
            <Text style={{ flex: 1 }}>{step}</Text>
          </View>
        ))}
      </View>

      {referral.claimedCode ? (
        <View style={styles.card}>
          <Text variant="label" muted>
            Your friend's code
          </Text>
          <Text variant="bodyStrong">{referral.claimedCode}</Text>
          <Text variant="caption" muted>
            {referral.claimedStatus === "rewarded"
              ? `${reward} added to your wallet. Thanks for joining!`
              : `${reward} will be added to your wallet after your first visit is completed.`}
          </Text>
        </View>
      ) : referral.canClaim ? (
        <View style={styles.card}>
          <Text variant="label" muted>
            Got a code from a friend?
          </Text>
          <Input
            label="Friend's code"
            value={code}
            onChangeText={(value) => setCode(value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="GZ2K7QMP"
            error={claimError}
            hint={`Enter it before your first visit to get ${reward}.`}
          />
          <Button label="Apply code" loading={claiming} disabled={code.trim().length < 6} onPress={() => void claim()} />
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
  codeBox: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  code: {
    letterSpacing: 3,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  step: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  stepIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
})
