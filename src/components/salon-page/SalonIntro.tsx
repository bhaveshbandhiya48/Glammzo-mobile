import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

import { QuickActionIcon, type QuickActionKind } from "./QuickActionIcon"
import { pastels, sp } from "./theme"

export type QuickAction = {
  kind: QuickActionKind
  label: string
  onPress: () => void
}

type Props = {
  name: string
  subtitle: string
  rating: number
  reviews: number
  /** "open" with closing time, "closed", or null when there is no schedule. */
  status: { open: true; closes: string | null } | { open: false } | null
  distanceKm: number
  actions: QuickAction[]
  about: string
  onPressRating: () => void
}

const ACTION_PASTEL: Record<QuickActionKind, { gradient: [string, string]; fill: string }> = {
  call: pastels.peach,
  whatsapp: pastels.mint,
  directions: pastels.sky,
  share: pastels.lavender,
}

/** Info sheet that overlaps the hero: name, pills, quick actions, about. */
export function SalonIntro({ name, subtitle, rating, reviews, status, distanceKm, actions, about, onPressRating }: Props) {
  const [aboutOpen, setAboutOpen] = useState(false)
  const [aboutClamped, setAboutClamped] = useState(false)
  const aboutText = about.trim()

  return (
    <View style={styles.sheet}>
      <Text style={styles.name} accessibilityRole="header">
        {name}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.pills}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reviews > 0 ? `Rated ${rating.toFixed(1)} from ${reviews} reviews. See reviews` : "New on Glammzo. See reviews"}
          onPress={onPressRating}
          style={[styles.pill, styles.ratingPill]}
        >
          <Text style={[styles.pillText, { color: sp.ratingInk }]}>
            {reviews > 0 ? `${rating.toFixed(1)}★ · ${reviews} review${reviews === 1 ? "" : "s"}` : "New on Glammzo"}
          </Text>
        </Pressable>
        {status ? (
          <View style={[styles.pill, styles.greyPill]}>
            <View style={[styles.dot, { backgroundColor: status.open ? sp.open : sp.closed }]} />
            <Text style={styles.pillText}>
              {status.open ? (status.closes ? `Open · till ${status.closes}` : "Open now") : "Closed"}
            </Text>
          </View>
        ) : null}
        {distanceKm > 0 ? (
          <View style={[styles.pill, styles.greyPill]}>
            <Text style={styles.pillText}>{distanceKm.toFixed(1)} km</Text>
          </View>
        ) : null}
      </View>

      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => {
            const pastel = ACTION_PASTEL[action.kind]
            return (
              <Pressable
                key={action.kind}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={action.onPress}
                style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}
              >
                <View style={styles.squircle}>
                  <GradientFill colors={pastel.gradient} angle={150} radius={20} />
                  <QuickActionIcon kind={action.kind} fill={pastel.fill} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      {aboutText ? (
        <View style={styles.about}>
          {/* Hidden full copy measures whether the 2-line clamp cuts anything. */}
          <Text
            style={[styles.aboutText, styles.measure]}
            onTextLayout={(event) => setAboutClamped(event.nativeEvent.lines.length > 2)}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {aboutText}
          </Text>
          <Text style={styles.aboutText} numberOfLines={aboutOpen ? undefined : 2}>
            {aboutText}
          </Text>
          {aboutClamped ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setAboutOpen((open) => !open)}>
              <Text style={styles.readMore}>{aboutOpen ? "Show less" : "Read more"}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#ffffff",
    paddingTop: 22,
    paddingHorizontal: 20,
  },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.8,
    color: sp.text,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 19,
    color: sp.secondary,
  },
  pills: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratingPill: {
    backgroundColor: sp.ratingBg,
  },
  greyPill: {
    backgroundColor: sp.grey,
  },
  pillText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: sp.text,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  actions: {
    marginTop: 20,
    flexDirection: "row",
  },
  action: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  squircle: {
    width: 56,
    height: 56,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: sp.text,
  },
  about: {
    marginTop: 20,
  },
  aboutText: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: sp.body,
  },
  measure: {
    position: "absolute",
    opacity: 0,
    left: 0,
    right: 0,
  },
  readMore: {
    marginTop: 4,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 21,
    color: sp.text,
  },
})
