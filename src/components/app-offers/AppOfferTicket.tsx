import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { appOfferValidity, type AppOffer } from "@/lib/app-offers-api"
import { colors, fontFamily } from "@/theme/tokens"

type Props = {
  offer: Pick<AppOffer, "headline" | "title" | "code" | "autoApply" | "minOrderRupees" | "endsOn">
  /** Replaces the usual "Use code" / validity line, e.g. "Saves ₹200 on this booking". */
  caption?: string | null
  /** Shown at the right edge, e.g. an Apply button. */
  action?: ReactNode
  /** Greyed out: the offer doesn't fit this cart yet. */
  dim?: boolean
  onPress?: () => void
  accessibilityLabel?: string
}

/** How a Glammzo offer reads in one line: code or automatic, minimum bill, end date. */
export function appOfferHowTo(offer: Props["offer"]) {
  const parts = [
    offer.code && !offer.autoApply ? `Use code ${offer.code}` : "Applied at checkout",
    offer.minOrderRupees > 0 ? `on bills above ₹${offer.minOrderRupees.toLocaleString("en-IN")}` : null,
  ].filter(Boolean)
  return parts.join(" ")
}

/**
 * A Glammzo offer drawn as a ticket: a dark stub with the saving, a punched edge, and the
 * details on the right. Used on salon and artist pages, in offer details and at checkout.
 */
export function AppOfferTicket({ offer, caption, action, dim, onPress, accessibilityLabel }: Props) {
  const validity = appOfferValidity(offer.endsOn)
  const body = (
    <View style={[styles.ticket, dim && styles.dim]}>
      <View style={styles.stub}>
        <Icon name="sparkles" size={14} color="#FFFFFF" />
        <Text style={styles.stubText} numberOfLines={3}>
          {offer.headline}
        </Text>
      </View>
      <View style={styles.edge} pointerEvents="none">
        <View style={[styles.notch, styles.notchTop]} />
        <View style={styles.dashes} />
        <View style={[styles.notch, styles.notchBottom]} />
      </View>
      <View style={styles.details}>
        <Text style={styles.eyebrow}>GLAMMZO OFFER</Text>
        <Text style={styles.title} numberOfLines={2}>
          {offer.title}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {caption ?? [appOfferHowTo(offer), validity].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  )
  if (!onPress) return body
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${offer.headline}. ${offer.title}. Opens offer details`}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  )
}

const NOTCH = 14

const styles = StyleSheet.create({
  ticket: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  dim: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.9,
  },
  stub: {
    width: 104,
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.hero,
  },
  stubText: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.3,
    color: "#FFFFFF",
  },
  edge: {
    width: NOTCH / 2,
    marginLeft: -NOTCH / 4,
    alignItems: "center",
    justifyContent: "space-between",
  },
  notch: {
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: colors.bg,
  },
  notchTop: {
    marginTop: -NOTCH / 2,
  },
  notchBottom: {
    marginBottom: -NOTCH / 2,
  },
  dashes: {
    flex: 1,
    width: 0,
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.inputBorder,
    marginVertical: 4,
  },
  details: {
    flex: 1,
    justifyContent: "center",
    gap: 3,
    paddingVertical: 12,
    paddingLeft: 8,
    paddingRight: 12,
  },
  eyebrow: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.2,
    color: colors.textSubtle,
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  action: {
    justifyContent: "center",
    paddingRight: 12,
  },
})
