import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import Svg, { Circle } from "react-native-svg"

import { GradientFill } from "@/components/home/GradientFill"
import { Text } from "@/components/ui/Text"
import { isGetQuotesEnabled } from "@/lib/get-quotes"
import { fetchLeads } from "@/lib/leads-api"
import { getAccessToken } from "@/lib/session"
import { fontFamily } from "@/theme/tokens"

export { isGetQuotesEnabled }

const AVATAR_TINTS = ["#f6c7b8", "#d9c8ff", "#bfe6d3"]

type OpenRequest = { id: string; quoteCount: number }

/** Home card for Get quotes. With an open request it points at its quotes instead. */
export function GetQuotesBanner() {
  const router = useRouter()
  const [open, setOpen] = useState<OpenRequest | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      if (!isGetQuotesEnabled()) return
      void (async () => {
        const token = await getAccessToken()
        if (!token) {
          if (active) setOpen(null)
          return
        }
        try {
          const requests = await fetchLeads()
          const first = requests.find((r) => r.status === "open")
          if (active) setOpen(first ? { id: first.id, quoteCount: first.quoteCount } : null)
        } catch {
          // Keep the default card.
        }
      })()
      return () => {
        active = false
      }
    }, []),
  )

  const subtitle = open
    ? open.quoteCount > 0
      ? `You have ${open.quoteCount} ${open.quoteCount === 1 ? "quote" : "quotes"} waiting`
      : "Your request is open · quotes on the way"
    : "Free · up to 5 quotes"
  const ctaLabel = open ? "View quotes" : "Get quotes"

  return (
    <View style={styles.card}>
      <GradientFill colors={["#fde8e1", "#fbeff6", "#ece8fe"]} angle={120} radius={22} />
      {/* Decorative ring tucked into the top-right corner, behind the text (title width is capped). */}
      <Svg style={styles.ring} width={140} height={140} pointerEvents="none">
        <Circle cx={70} cy={70} r={50} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={18} fill="none" />
      </Svg>
      <Text style={styles.eyebrow}>WEDDINGS · PARTIES · EVENTS</Text>
      <Text style={styles.title}>Let top artists come to you with a price</Text>
      <View style={styles.footer}>
        <View style={styles.proof}>
          <View style={styles.stack}>
            {AVATAR_TINTS.map((tint, index) => (
              <View
                key={tint}
                style={[styles.avatar, { backgroundColor: tint, marginLeft: index === 0 ? 0 : -10 }]}
              />
            ))}
          </View>
          <Text style={styles.proofText}>{subtitle}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          onPress={() =>
            open
              ? router.push({ pathname: "/requests/[id]", params: { id: open.id } })
              : router.push("/requests/new")
          }
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{ctaLabel} →</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 28,
    borderRadius: 22,
    padding: 18,
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    top: -62,
    right: -52,
    zIndex: 0,
  },
  eyebrow: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: "#8a3524",
    zIndex: 1,
  },
  title: {
    marginTop: 6,
    fontFamily: fontFamily.bold,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: "#111111",
    maxWidth: "68%",
    zIndex: 1,
  },
  footer: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    zIndex: 1,
  },
  proof: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  stack: {
    flexDirection: "row",
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  proofText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: "#4b4b4b",
    flexShrink: 1,
  },
  cta: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: {
    backgroundColor: "#2b2b2b",
  },
  ctaText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: "#ffffff",
  },
})
