import { Stack, useFocusEffect, useRouter } from "expo-router"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { AccessibilityInfo, Pressable, ScrollView, Share, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GradientFill } from "@/components/home/GradientFill"
import { PastelIcon } from "@/components/profile/ProfileParts"
import { pastels, sp, ui } from "@/components/salon-page/theme"
import { Button } from "@/components/ui/Button"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
import { SkeletonBone } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { copyCode } from "@/lib/copy-code"
import { LEGAL } from "@/lib/legal"
import { formatRupees } from "@/lib/service-pricing"
import { getAccessToken } from "@/lib/session"
import { claimReferral, fetchReferral, type ReferralSummary } from "@/lib/wallet-api"
import { fontFamily } from "@/theme/tokens"

const HEADER_GRADIENT = ["#fff7d6", "#ffffff"]
const MUTED = "#8a8a8a"

export default function ReferScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [referral, setReferral] = useState<ReferralSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
  }, [])

  function copyReferralCode() {
    if (!referral?.code || !copyCode(referral.code)) return
    setCopied(true)
    AccessibilityInfo.announceForAccessibility(`Code ${referral.code} copied`)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 1500)
  }
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)

  const load = useCallback(
    async (isActive: () => boolean = () => true) => {
      if (!(await getAccessToken())) {
        router.replace({ pathname: "/login", params: { next: "/profile/refer" } })
        return
      }
      setLoading(true)
      setError(null)
      try {
        const next = await fetchReferral()
        if (isActive()) setReferral(next)
      } catch {
        if (isActive()) setError("Couldn't load your referral code right now.")
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

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/profile")
  }

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

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <GradientFill colors={HEADER_GRADIENT} angle={180} />
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={6}
          onPress={goBack}
          style={({ pressed }) => [styles.back, pressed && ui.pressed]}
        >
          <Icon name="chevron-back" size={20} color={sp.text} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          Refer a friend
        </Text>
      </View>
      {referral?.code && !loading && !error ? (
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>You both get {reward}</Text>
            <Text style={styles.heroSubtitle}>Wallet credit after your friend's first completed visit.</Text>
          </View>
          <HeroArt />
        </View>
      ) : null}
    </View>
  )

  let body: ReactNode
  if (loading) {
    body = <ReferSkeleton />
  } else if (error || !referral?.code) {
    body = (
      <View style={[styles.card, styles.errorCard]}>
        <PastelIcon pastel={pastels.peach} name="alert-circle-outline" />
        <Text style={styles.errorTitle}>Couldn't load your code</Text>
        <Text style={styles.errorText}>
          {error ?? "Couldn't load your referral code right now. Please try again in a moment."}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void load()}
          style={({ pressed }) => [styles.outlinePill, pressed && ui.pressed]}
        >
          <Text style={styles.outlinePillText}>Try again</Text>
        </Pressable>
      </View>
    )
  } else {
    const steps: { icon: IconName; pastel: (typeof pastels)[keyof typeof pastels]; text: string }[] = [
      { icon: "share-social-outline", pastel: pastels.sky, text: "Share your code" },
      { icon: "calendar-outline", pastel: pastels.lavender, text: "Friend books and completes their first visit" },
      { icon: "wallet-outline", pastel: pastels.mint, text: `You both get ${reward} in your wallet` },
    ]
    body = (
      <>
        <Text style={[ui.sectionLabel, styles.sectionLabel]}>Your code</Text>
        <View style={styles.card}>
          <View style={styles.codeChip}>
            <Text
              style={styles.codeText}
              selectable
              numberOfLines={1}
              accessibilityLabel={`Your code ${referral.code.split("").join(" ")}`}
            >
              {referral.code}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Copy code ${referral.code}`}
              onPress={copyReferralCode}
              hitSlop={8}
              style={({ pressed }) => [styles.copyPill, pressed && ui.pressed]}
            >
              <Icon name={copied ? "checkmark" : "copy-outline"} size={16} color={sp.text} />
              <Text style={styles.copyPillText}>{copied ? "Copied" : "Copy"}</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share invite"
            onPress={() => void share()}
            style={({ pressed }) => [styles.sharePill, pressed && ui.pressed]}
          >
            <Icon name="share-social-outline" size={18} color="#ffffff" />
            <Text style={styles.sharePillText}>Share invite</Text>
          </Pressable>
        </View>

        <Text style={[ui.sectionLabel, styles.sectionLabel]}>How it works</Text>
        <View style={styles.card}>
          {steps.map((step, index) => (
            <View key={step.text} style={styles.step}>
              <PastelIcon pastel={step.pastel} name={step.icon} />
              <View style={styles.stepText}>
                <Text style={styles.stepNumber}>Step {index + 1}</Text>
                <Text style={styles.stepLabel}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[ui.sectionLabel, styles.sectionLabel]}>Your referrals</Text>
        <View style={styles.card}>
          <View style={styles.stats}>
            <StatBox value={String(referral.invited)} label="Joined" />
            <StatBox value={String(referral.rewarded)} label="Rewarded" />
            <StatBox value={formatRupees(referral.earnedRupees)} label="Earned" />
          </View>
          {referral.invited === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No referrals yet</Text>
              <Text style={styles.emptyText}>Friends who use your code show up here.</Text>
            </View>
          ) : (
            <View style={styles.statusRows}>
              {referral.rewarded > 0 ? (
                <StatusRow
                  label={`${referral.rewarded} ${referral.rewarded === 1 ? "friend" : "friends"} completed a visit`}
                  status="rewarded"
                />
              ) : null}
              {referral.invited - referral.rewarded > 0 ? (
                <StatusRow
                  label={`${referral.invited - referral.rewarded} waiting for a first visit`}
                  status="pending"
                />
              ) : null}
            </View>
          )}
        </View>

        {referral.claimedCode ? (
          <>
            <Text style={[ui.sectionLabel, styles.sectionLabel]}>Your friend's code</Text>
            <View style={styles.card}>
              <View style={styles.claimedRow}>
                <Text style={styles.claimedCode}>{referral.claimedCode}</Text>
                <StatusPill status={referral.claimedStatus === "rewarded" ? "rewarded" : "pending"} />
              </View>
              <Text style={styles.cardText}>
                {referral.claimedStatus === "rewarded"
                  ? `${reward} added to your wallet. Thanks for joining!`
                  : `${reward} will be added to your wallet after your first visit is completed.`}
              </Text>
            </View>
          </>
        ) : referral.canClaim ? (
          <>
            <Text style={[ui.sectionLabel, styles.sectionLabel]}>Got a code from a friend?</Text>
            <View style={styles.card}>
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
              <Button
                label="Apply code"
                loading={claiming}
                disabled={code.trim().length < 6}
                onPress={() => void claim()}
              />
            </View>
          </>
        ) : null}

        <Text style={styles.terms}>
          Your friend enters your code under Profile → Refer a friend before their first visit. You both get{" "}
          {reward} wallet credit once that first visit is completed. Only for friends who haven't booked on Glammzo
          yet.
        </Text>
      </>
    )
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {header}
        <View style={styles.body}>{body}</View>
      </ScrollView>
    </View>
  )
}

/** Two overlapping pastel circles: a gift and a friend. */
function HeroArt() {
  return (
    <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.artCircle, styles.artBack]}>
        <GradientFill colors={pastels.pink.gradient} angle={150} />
        <Icon name="person-outline" size={30} color={pastels.pink.ink} />
      </View>
      <View style={[styles.artCircle, styles.artFront]}>
        <GradientFill colors={pastels.gold.gradient} angle={150} />
        <Icon name="gift-outline" size={30} color={pastels.gold.ink} />
      </View>
    </View>
  )
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

function StatusPill({ status }: { status: "pending" | "rewarded" }) {
  const rewarded = status === "rewarded"
  return (
    <View style={[styles.pill, { backgroundColor: rewarded ? sp.ratingBg : sp.peachBg }]}>
      <Text style={[styles.pillText, { color: rewarded ? sp.ratingInk : sp.peachInk }]}>
        {rewarded ? "Rewarded" : "Pending"}
      </Text>
    </View>
  )
}

function StatusRow({ label, status }: { label: string; status: "pending" | "rewarded" }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <StatusPill status={status} />
    </View>
  )
}

function ReferSkeleton() {
  return (
    <View style={styles.skeleton} accessibilityLabel="Loading your referral code">
      <SkeletonBone width="70%" height={28} radius={8} />
      <SkeletonBone width="90%" height={14} />
      <SkeletonBone height={150} radius={16} style={{ marginTop: 12 }} />
      <SkeletonBone height={190} radius={16} />
      <SkeletonBone height={120} radius={16} />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  scrollContent: { flexGrow: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, color: sp.text },
  hero: { marginTop: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  heroText: { flex: 1, minWidth: 0, gap: 6 },
  heroTitle: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34, color: sp.text },
  heroSubtitle: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: sp.secondary },
  art: { width: 108, height: 84 },
  artCircle: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  artBack: { left: 0, top: 0 },
  artFront: { right: 0, bottom: 0 },
  body: { paddingHorizontal: 16 },
  sectionLabel: { marginTop: 24, marginBottom: 10, paddingHorizontal: 4 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 14,
  },
  cardText: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: sp.secondary },
  codeChip: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#6b4e00",
    backgroundColor: "#fffbea",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  codeText: { flexShrink: 1, fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, letterSpacing: 2, color: sp.text },
  copyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#6b4e00",
    backgroundColor: "#ffffff",
  },
  copyPillText: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 17, color: sp.text },
  sharePill: {
    height: 52,
    borderRadius: 999,
    backgroundColor: sp.text,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sharePillText: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 21, color: "#ffffff" },
  outlinePill: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: sp.text,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  outlinePillText: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18, color: sp.text },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepText: { flex: 1, minWidth: 0, gap: 1 },
  stepNumber: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, color: sp.secondary },
  stepLabel: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: sp.text },
  stats: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: sp.grey,
    gap: 2,
  },
  statValue: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22, color: sp.text },
  statLabel: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, color: sp.secondary },
  empty: { alignItems: "center", paddingVertical: 6, gap: 2 },
  emptyTitle: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: sp.text },
  emptyText: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: sp.secondary },
  statusRows: { gap: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  statusLabel: { flex: 1, fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 19, color: sp.text },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16 },
  claimedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  claimedCode: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22, letterSpacing: 1.5, color: sp.text },
  terms: {
    marginTop: 24,
    paddingHorizontal: 4,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  errorCard: { marginTop: 16, alignItems: "center", paddingVertical: 24 },
  errorTitle: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 21, color: sp.text },
  errorText: {
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.secondary,
    marginTop: -6,
  },
  skeleton: { marginTop: 20, gap: 12 },
})
