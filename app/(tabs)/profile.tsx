import { useCallback, useState } from "react"
import Constants from "expo-constants"
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useFocusEffect, useRouter } from "expo-router"

import { GradientFill } from "@/components/home/GradientFill"
import { pastelForName } from "@/components/home/PhotoFallback"
import { ProfileGroup, StatTile, type ProfileRowProps } from "@/components/profile/ProfileParts"
import { pastels, sp, ui } from "@/components/salon-page/theme"
import { useFloatingTabBarSpace } from "@/components/ui/FloatingTabBar"
import { Text } from "@/components/ui/Text"
import { useArtistFavorites } from "@/context/ArtistFavoritesContext"
import { useFavorites } from "@/context/FavoritesContext"
import { ApiError } from "@/lib/api"
import { fetchMe } from "@/lib/auth-api"
import { isGetQuotesEnabled } from "@/lib/get-quotes"
import { fetchLeads } from "@/lib/leads-api"
import { LEGAL } from "@/lib/legal"
import { LOYALTY_VISITS_PER_FREE, type LoyaltySummary } from "@/lib/loyalty"
import { formatRupees } from "@/lib/service-pricing"
import { getAccessToken } from "@/lib/session"
import { clearLocalSession, getConsumerProfile, getDisplayName } from "@/lib/user"
import { fetchLoyalty, fetchReferral, fetchWallet, type ReferralSummary } from "@/lib/wallet-api"
import { fontFamily } from "@/theme/tokens"

const APP_VERSION = Constants.expoConfig?.version?.trim() || ""
const DANGER = "#c0392b"
const LOGIN_ROUTE = { pathname: "/login", params: { next: "/(tabs)/profile" } } as const

/** "+918758431673" → "+91 87584 31673". */
function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(-10)
  if (digits.length !== 10) return raw
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const tabBarSpace = useFloatingTabBarSpace()
  const router = useRouter()
  const quotesOn = isGetQuotesEnabled()
  const favorites = useFavorites()
  const artistFavorites = useArtistFavorites()

  const [ready, setReady] = useState(false)
  const [name, setName] = useState("Guest")
  const [phone, setPhone] = useState("")
  const [walletRupees, setWalletRupees] = useState<number | null>(null)
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null)
  const [referral, setReferral] = useState<ReferralSummary | null>(null)
  const [openQuotes, setOpenQuotes] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let active = true
      // Keep the scrolled screen mounted on return — only refresh data in place.
      ;(async () => {
        const [token, displayName] = await Promise.all([getAccessToken(), getDisplayName()])
        if (!active) return
        if (!token) {
          setReady(false)
          router.replace(LOGIN_ROUTE)
          return
        }
        try {
          await fetchMe()
        } catch (error) {
          if (!active) return
          if (error instanceof ApiError && error.status === 401) {
            setReady(false)
            router.replace(LOGIN_ROUTE)
            return
          }
        }
        if (!active) return
        setName(displayName)
        setReady(true)

        // Everything below fills in on its own; none of it blocks the screen.
        void getConsumerProfile().then((profile) => {
          if (active) setPhone(profile.phone)
        })
        fetchWallet()
          .then((wallet) => active && setWalletRupees(wallet.wallet?.balanceRupees ?? 0))
          .catch(() => active && setWalletRupees(null))
        fetchLoyalty()
          .then((next) => active && setLoyalty(next))
          .catch(() => active && setLoyalty(null))
        fetchReferral()
          .then((next) => active && setReferral(next))
          .catch(() => active && setReferral(null))
        if (quotesOn) {
          fetchLeads()
            .then((leads) => {
              if (!active) return
              setOpenQuotes(
                leads
                  .filter((lead) => lead.status === "open")
                  .reduce((sum, lead) => sum + (lead.quoteCount ?? 0), 0),
              )
            })
            .catch(() => active && setOpenQuotes(0))
        }
      })()
      return () => {
        active = false
      }
    }, [router, quotesOn]),
  )

  if (!ready) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator color={sp.peachInk} />
      </View>
    )
  }

  const savedReady = favorites.hydrated && artistFavorites.hydrated
  const savedCount = favorites.ids.length + artistFavorites.slugs.length
  const savedText = savedReady ? String(savedCount) : "–"
  const stamps = loyalty ? Math.min(loyalty.stampsTowardNextFree, LOYALTY_VISITS_PER_FREE) : null
  const loyaltyValue = !loyalty
    ? null
    : loyalty.freeServiceCredits > 0
      ? "Free visit ready"
      : `${loyalty.visitsLeft} to go`
  const referralCode = referral?.code?.trim() || ""
  const rewardText = referral?.rewardRupees ? formatRupees(referral.rewardRupees) : null
  const avatarPastel = pastelForName(name)
  const go = (href: Parameters<typeof router.push>[0]) => () => router.push(href)

  async function shareReferral() {
    if (!referralCode) return
    const reward = formatRupees(referral?.rewardRupees ?? 199)
    await Share.share({
      message: `Book salons and beauty artists on Glammzo. Use my code ${referralCode} and we both get ${reward} in our Glammzo wallet after your first visit. ${LEGAL.siteUrl}`,
    })
  }

  const account: ProfileRowProps[] = [
    { label: "Your profile", icon: "person-outline", pastel: pastels.peach, onPress: go("/profile/details") },
    {
      label: "Saved",
      icon: "heart-outline",
      pastel: pastels.pink,
      value: savedReady ? String(savedCount) : null,
      onPress: go("/profile/favorites"),
    },
    ...(quotesOn
      ? [
          {
            label: "My requests",
            icon: "pricetags-outline",
            pastel: pastels.lavender,
            badge: openQuotes > 0 ? `${openQuotes} ${openQuotes === 1 ? "quote" : "quotes"}` : null,
            onPress: go("/requests"),
          } satisfies ProfileRowProps,
        ]
      : []),
  ]

  const money: ProfileRowProps[] = [
    { label: "Wallet activity", icon: "receipt-outline", pastel: pastels.mint, onPress: go("/profile/activity") },
    {
      label: "Loyalty rewards",
      icon: "ribbon-outline",
      pastel: pastels.gold,
      value: loyaltyValue,
      onPress: go("/profile/loyalty"),
    },
    { label: "Gift cards", icon: "card-outline", pastel: pastels.sky, onPress: go("/profile/gift-cards") },
    {
      label: "Refer a friend",
      icon: "gift-outline",
      pastel: pastels.peach,
      value: rewardText ? `Get ${rewardText}` : null,
      onPress: go("/profile/refer"),
    },
  ]

  const help: ProfileRowProps[] = [
    { label: "Help and support", icon: "help-circle-outline", pastel: pastels.teal, onPress: go("/profile/support") },
    {
      label: "Notifications",
      icon: "notifications-outline",
      pastel: pastels.lavender,
      hint: "Opens your phone's settings for Glammzo",
      onPress: () => void Linking.openSettings(),
    },
  ]

  const about: ProfileRowProps[] = [
    { label: "Terms of service", url: LEGAL.termsUrl, icon: "document-text-outline" as const },
    { label: "Privacy policy", url: LEGAL.privacyUrl, icon: "shield-checkmark-outline" as const },
    { label: "Cancellation policy", url: LEGAL.cancellationUrl, icon: "close-circle-outline" as const },
  ].map(({ url, ...row }) => ({
    ...row,
    pastel: pastels.sky,
    external: true,
    onPress: () => void Linking.openURL(url),
  }))

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: tabBarSpace + 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />
        <Text style={styles.title} accessibilityRole="header">
          Profile
        </Text>
        <View style={styles.identity}>
          <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <GradientFill colors={avatarPastel.gradient} angle={150} />
            <Text style={[styles.avatarInitial, { color: avatarPastel.ink }]}>
              {name.trim().charAt(0).toUpperCase() || "G"}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.phone} numberOfLines={1}>
              {formatPhone(phone) || "Signed in with mobile"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit your profile"
            onPress={go("/profile/details")}
            style={({ pressed }) => [styles.editPill, pressed && ui.pressed]}
          >
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.tiles}>
          <StatTile
            pastel={pastels.mint}
            icon="wallet-outline"
            value={walletRupees == null ? "–" : formatRupees(walletRupees)}
            label="Wallet"
            accessibilityLabel={walletRupees == null ? "Wallet" : `Wallet, ${formatRupees(walletRupees)}`}
            onPress={go("/profile/wallet")}
          />
          <StatTile
            pastel={pastels.peach}
            icon="ribbon-outline"
            value={stamps == null ? "–" : `${stamps}/${LOYALTY_VISITS_PER_FREE}`}
            label="Stamps"
            accessibilityLabel={
              stamps == null ? "Loyalty stamps" : `Loyalty stamps, ${stamps} of ${LOYALTY_VISITS_PER_FREE}`
            }
            onPress={go("/profile/loyalty")}
          >
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${((stamps ?? 0) / LOYALTY_VISITS_PER_FREE) * 100}%` }]} />
            </View>
          </StatTile>
          <StatTile
            pastel={pastels.pink}
            icon="heart-outline"
            value={savedText}
            label="Saved"
            accessibilityLabel={savedReady ? `Saved, ${savedCount}` : "Saved"}
            onPress={go("/profile/favorites")}
          />
        </View>

        {referralCode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refer a friend"
            onPress={go("/profile/refer")}
            style={({ pressed }) => [styles.refer, pressed && ui.pressed]}
          >
            <View style={styles.referText}>
              <View style={styles.referCopy}>
                <Text style={styles.referTitle}>
                  {rewardText ? `Refer a friend, get ${rewardText}` : "Refer a friend"}
                </Text>
                <Text style={styles.referSubtitle}>
                  {rewardText
                    ? `Share your code. You get ${rewardText} after their first completed visit. They get ${rewardText} too.`
                    : "Share your code. You both get wallet credit after their first completed visit."}
                </Text>
              </View>
              <View style={styles.codeChip}>
                <Text style={styles.codeText} selectable>
                  {referralCode}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share your referral code"
              onPress={() => void shareReferral()}
              style={({ pressed }) => [ui.blackPill, styles.sharePill, pressed && ui.pressed]}
            >
              <Text style={ui.blackPillText}>Share</Text>
            </Pressable>
          </Pressable>
        ) : null}

        <ProfileGroup title="Account" rows={account} />
        <ProfileGroup title="Money and rewards" rows={money} />
        <ProfileGroup title="Help and settings" rows={help} />
        <ProfileGroup title="About" rows={about} />

        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await clearLocalSession()
            setWalletRupees(null)
            setLoyalty(null)
            setReferral(null)
            setOpenQuotes(0)
            setReady(false)
            router.replace(LOGIN_ROUTE)
          }}
          style={({ pressed }) => [styles.logout, pressed && ui.pressed]}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>

        {APP_VERSION ? <Text style={styles.version}>Glammzo {APP_VERSION}</Text> : null}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  header: { paddingHorizontal: 16, paddingBottom: 20 },
  title: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 30, color: sp.text },
  identity: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32 },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, color: sp.text },
  phone: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 18, color: sp.secondary },
  editPill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  editText: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 17, color: sp.text },
  body: { paddingHorizontal: 16 },
  tiles: { flexDirection: "row", gap: 10 },
  track: { height: 4, borderRadius: 2, backgroundColor: sp.peachBg, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2, backgroundColor: sp.peachInk },
  refer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff7d6",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  referText: { flex: 1, minWidth: 0, gap: 10, alignItems: "flex-start" },
  referTitle: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 21, color: "#6b4e00" },
  referCopy: { gap: 2 },
  referSubtitle: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: "#6b4e00" },
  codeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#6b4e00",
  },
  codeText: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 17, letterSpacing: 1, color: "#6b4e00" },
  sharePill: { paddingHorizontal: 18 },
  logout: {
    marginTop: 28,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: DANGER,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: DANGER },
  version: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: "#8a8a8a",
  },
})
