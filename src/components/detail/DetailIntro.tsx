import { useState, type ReactNode } from "react"
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { colors, radii, spacing, status as tint } from "@/theme/tokens"

export type DetailStat = { value: string; label: string; onPress?: () => void }
export type DetailAction = { icon: IconName; label: string; onPress: () => void; iconColor?: string }

type Props = {
  /** Small coloured chip above the name, e.g. "Open now" (success) or "Closed" (danger). */
  status?: { label: string; tone: "success" | "danger" | "neutral" } | null
  /** Short offer line shown as a chip next to the status. */
  offerLabel?: string | null
  title: string
  /** Rendered right after the title, e.g. a verified tick. */
  titleAccessory?: ReactNode
  subtitle?: string | null
  stats: DetailStat[]
  actions: DetailAction[]
  about?: string | null
  /** An avatar pulled up over the photo. The status and offer chips sit beside it. */
  leading?: ReactNode
  style?: StyleProp<ViewStyle>
}

const TONES = {
  success: { fg: tint.successFg, bg: tint.successBg },
  danger: { fg: tint.dangerFg, bg: tint.dangerBg },
  neutral: { fg: colors.textMuted, bg: colors.muted },
}

/**
 * Top of a salon or artist page: a card that overlaps the photo, with status, name,
 * three quick stats, labelled actions and a short "about" that expands.
 */
export function DetailIntro({ status, offerLabel, title, titleAccessory, subtitle, stats, actions, about, leading, style }: Props) {
  const [aboutOpen, setAboutOpen] = useState(false)
  const aboutText = about?.trim() ?? ""
  const longAbout = aboutText.length > 140

  const chips = (
    <>
      {status ? (
        <View style={[styles.chip, { backgroundColor: TONES[status.tone].bg }]}>
          <View style={[styles.chipDot, { backgroundColor: TONES[status.tone].fg }]} />
          <Text variant="caption" color={TONES[status.tone].fg}>
            {status.label}
          </Text>
        </View>
      ) : null}
      {offerLabel ? (
        <View style={[styles.chip, styles.offerChip]}>
          <Icon name="pricetag-outline" size={12} color={colors.primaryFg} />
          <Text variant="caption" color={colors.primaryFg} numberOfLines={1} style={{ flexShrink: 1 }}>
            {offerLabel}
          </Text>
        </View>
      ) : null}
    </>
  )

  return (
    <View style={[styles.card, style]}>
      {leading ? (
        <View style={styles.leadingRow}>
          {leading}
          <View style={styles.leadingChips}>{chips}</View>
        </View>
      ) : status || offerLabel ? (
        <View style={styles.chipsRow}>{chips}</View>
      ) : null}

      <View style={styles.titleRow}>
        <Text variant="title" style={styles.title}>
          {title}
        </Text>
        {titleAccessory}
      </View>
      {subtitle ? (
        <Text muted style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}

      {stats.length > 0 ? (
        <View style={styles.stats}>
          {stats.map((stat, index) => {
            const body = (
              <>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {stat.value}
                </Text>
                <Text variant="caption" muted numberOfLines={1}>
                  {stat.label}
                </Text>
              </>
            )
            return (
              <View key={stat.label} style={[styles.stat, index > 0 && styles.statDivider]}>
                {stat.onPress ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${stat.value} ${stat.label}`}
                    onPress={stat.onPress}
                    style={styles.statHit}
                  >
                    {body}
                  </Pressable>
                ) : (
                  <View style={styles.statHit} accessible accessibilityLabel={`${stat.value} ${stat.label}`}>
                    {body}
                  </View>
                )}
              </View>
            )
          })}
        </View>
      ) : null}

      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={action.onPress}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            >
              <View style={styles.actionIcon}>
                <Icon name={action.icon} size={20} color={action.iconColor ?? colors.text} />
              </View>
              <Text variant="caption" numberOfLines={1}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {aboutText ? (
        <View style={styles.about}>
          <Text style={styles.aboutText} numberOfLines={aboutOpen || !longAbout ? undefined : 3}>
            {aboutText}
          </Text>
          {longAbout ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setAboutOpen((open) => !open)}
              hitSlop={8}
              style={styles.readMore}
            >
              <Text variant="caption" style={styles.readMoreText}>
                {aboutOpen ? "Show less" : "Read more"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    maxWidth: "100%",
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  offerChip: {
    backgroundColor: colors.primary,
  },
  // Avatar overlaps the photo; its chips sit beside it, on the card.
  leadingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  leadingChips: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 28,
    letterSpacing: -0.8,
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 4,
  },
  stats: {
    flexDirection: "row",
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  stat: {
    flex: 1,
  },
  statDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  statHit: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  action: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  actionPressed: {
    backgroundColor: colors.muted,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  about: {
    marginTop: spacing.lg,
    gap: 4,
  },
  aboutText: {
    lineHeight: 22,
  },
  readMore: {
    alignSelf: "flex-start",
    minHeight: 28,
    justifyContent: "center",
  },
  readMoreText: {
    fontFamily: "Geist_600SemiBold",
    textDecorationLine: "underline",
  },
})
