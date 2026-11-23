import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"

import { BottomSheet } from "@/components/ui/BottomSheet"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { CheckoutAppOffer } from "@/lib/app-offers-api"
import { colors, fontFamily } from "@/theme/tokens"

import { AppOfferTicket } from "./AppOfferTicket"
import type { CheckoutAppOffersState } from "./useCheckoutAppOffers"

/**
 * The Glammzo offers row at checkout: the applied saving, or how many offers there are, with a
 * sheet to pick one.
 */
export function CheckoutOffers({ state }: { state: CheckoutAppOffersState }) {
  const [open, setOpen] = useState(false)
  const usable = state.offers.filter((offer) => offer.status === "usable")
  if (!state.applied && state.offers.length === 0 && !state.problem) return null

  const applied = state.applied
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          applied
            ? `${applied.headline} applied, saves ₹${applied.discountRupees}. Change offer`
            : `${usable.length} Glammzo offers. See offers`
        }
        style={({ pressed }) => [styles.row, applied && styles.rowApplied, pressed && styles.pressed]}
      >
        <View style={[styles.badge, applied && styles.badgeApplied]}>
          <Icon name={applied ? "checkmark" : "sparkles"} size={16} color="#FFFFFF" />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {applied ? `You save ₹${applied.discountRupees.toLocaleString("en-IN")}` : "Glammzo offers"}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {applied
              ? `${applied.headline} · ${state.isAutomatic ? "applied for you" : (applied.code ?? "Glammzo offer")}`
              : usable.length > 0
                ? `${usable.length} ${usable.length === 1 ? "offer fits" : "offers fit"} this booking`
                : "See what you can unlock"}
          </Text>
        </View>
        {state.loading ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : (
          <Text style={styles.link}>{applied ? "Change" : "View"}</Text>
        )}
      </Pressable>
      {state.problem ? <Text style={styles.problem}>{state.problem}</Text> : null}

      <BottomSheet visible={open} title="Glammzo offers" onClose={() => setOpen(false)} expanded>
        <View style={styles.sheet}>
          <Text style={styles.sheetIntro}>
            Paid by Glammzo and taken off your bill now. One Glammzo offer per booking.
          </Text>
          {state.offers.map((offer) => (
            <OfferOption
              key={offer.id}
              offer={offer}
              applied={applied?.id === offer.id}
              onApply={() => {
                state.pick(offer)
                setOpen(false)
              }}
            />
          ))}
          {state.offers.length === 0 ? (
            <Text style={styles.sheetIntro}>No offers for this booking right now.</Text>
          ) : null}
          {applied ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                state.remove()
                setOpen(false)
              }}
              style={styles.skip}
            >
              <Text style={styles.skipText}>Book without an offer</Text>
            </Pressable>
          ) : !state.isAutomatic ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                state.useBest()
                setOpen(false)
              }}
              style={styles.skip}
            >
              <Text style={styles.skipText}>Use the best offer for me</Text>
            </Pressable>
          ) : null}
        </View>
      </BottomSheet>
    </View>
  )
}

function OfferOption({
  offer,
  applied,
  onApply,
}: {
  offer: CheckoutAppOffer
  applied: boolean
  onApply: () => void
}) {
  const usable = offer.status === "usable"
  return (
    <AppOfferTicket
      offer={offer}
      dim={!usable}
      caption={
        usable
          ? `Saves ₹${offer.discountRupees.toLocaleString("en-IN")} on this booking`
          : (offer.note ?? "Doesn't fit this booking yet")
      }
      action={
        usable ? (
          applied ? (
            <View style={[styles.pill, styles.pillApplied]}>
              <Text style={styles.pillAppliedText}>Applied</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Apply ${offer.headline}`}
              onPress={onApply}
              style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
            >
              <Text style={styles.pillText}>Apply</Text>
            </Pressable>
          )
        ) : null
      }
    />
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  rowApplied: {
    borderStyle: "solid",
    borderColor: colors.success,
  },
  pressed: {
    opacity: 0.85,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.hero,
  },
  badgeApplied: {
    backgroundColor: colors.success,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  rowSub: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  link: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.text,
    textDecorationLine: "underline",
  },
  problem: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.destructive,
  },
  sheet: {
    gap: 12,
    paddingBottom: 8,
  },
  sheetIntro: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  pillText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: "#FFFFFF",
  },
  pillApplied: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.success,
  },
  pillAppliedText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.success,
  },
  skip: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.text,
    textDecorationLine: "underline",
  },
})
