import { StyleSheet, View } from "react-native"

import { BottomSheet } from "@/components/ui/BottomSheet"
import { CodeChip } from "@/components/ui/CodeChip"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { PrimaryPill } from "@/components/profile/ProfileScreenParts"
import { appOfferValidity, type AppOffer } from "@/lib/app-offers-api"
import { colors, fontFamily } from "@/theme/tokens"

import { AppOfferTicket } from "./AppOfferTicket"

type Props = {
  offer: AppOffer | null
  onClose: () => void
  /** Footer button, e.g. "Book a service". Hidden when not given. */
  ctaLabel?: string
  onPressCta?: () => void
}

/** The full story of one Glammzo offer: how to use it, the limits and the terms. */
export function AppOfferDetailsSheet({ offer, onClose, ctaLabel, onPressCta }: Props) {
  const validity = offer ? appOfferValidity(offer.endsOn) : null
  return (
    <BottomSheet
      visible={offer != null}
      title="Offer details"
      onClose={onClose}
      footer={
        offer && ctaLabel && onPressCta ? (
          <PrimaryPill
            label={ctaLabel}
            onPress={() => {
              onClose()
              onPressCta()
            }}
          />
        ) : undefined
      }
    >
      {offer ? (
        <View style={styles.body}>
          <AppOfferTicket offer={offer} />
          {offer.code ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>
                {offer.autoApply ? "Applies by itself. The code works too." : "Type this code at checkout"}
              </Text>
              <CodeChip code={offer.code} />
            </View>
          ) : null}
          <View style={styles.facts}>
            <Fact
              icon="flash-outline"
              text={
                offer.autoApply
                  ? "Applied automatically when your bill qualifies"
                  : "Taken off your bill at checkout"
              }
            />
            {offer.minOrderRupees > 0 ? (
              <Fact
                icon="receipt-outline"
                text={`On bills above ₹${offer.minOrderRupees.toLocaleString("en-IN")}`}
              />
            ) : null}
            <Fact icon="phone-portrait-outline" text="Only when you book in the Glammzo app" />
            {validity ? <Fact icon="time-outline" text={validity} /> : null}
          </View>
          {offer.terms ? (
            <View style={styles.terms}>
              <Text style={styles.termsLabel}>Terms</Text>
              <Text style={styles.termsText}>{offer.terms}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  )
}

function Fact({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factIcon}>
        <Icon name={icon} size={16} />
      </View>
      <Text style={styles.factText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    gap: 16,
  },
  codeBox: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.inputBorder,
  },
  codeLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  facts: {
    gap: 12,
  },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  factIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  factText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  terms: {
    gap: 4,
  },
  termsLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  termsText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
})
