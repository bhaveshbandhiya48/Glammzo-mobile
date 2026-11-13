import { Pressable, StyleSheet, View } from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

/** The quotes flow isn't built yet: Home shows this only when the flag is on. */
export function isGetQuotesEnabled() {
  return process.env.EXPO_PUBLIC_GET_QUOTES_ENABLED === "true"
}

const AVATAR_TINTS = ["#f6c7b8", "#d9c8ff", "#bfe6d3"]

export function GetQuotesBanner({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.card}>
      <GradientFill colors={["#fde8e1", "#fbeff6", "#ece8fe"]} angle={120} radius={22} />
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
          <Text style={styles.proofText}>Free · up to 5 quotes</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get quotes"
          onPress={onPress}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>Get quotes →</Text>
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
  eyebrow: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: "#8a3524",
  },
  title: {
    marginTop: 6,
    fontFamily: fontFamily.bold,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: "#111111",
    maxWidth: 260,
  },
  footer: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
