import { useMemo, useState } from "react"
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"

import { PastelIcon, type Pastel } from "@/components/profile/ProfileParts"
import { PrimaryPill } from "@/components/profile/ProfileScreenParts"
import { OfferCard, OfferDots } from "@/components/salon-page/OfferCard"
import { pastels, sp, ui } from "@/components/salon-page/theme"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { CodeChip } from "@/components/ui/CodeChip"
import { type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { SalonOffer } from "@/data/types"
import { fontFamily } from "@/theme/tokens"

type DisplayOffer = {
  key: string
  kind: "salon"
  offer: SalonOffer
}

type Props = {
  salonOffers: SalonOffer[]
  /** Left / right inset of the first and last card (the page gutter). */
  contentInset?: number
  onPressCta?: () => void
}

function salonDiscountLabel(offer: SalonOffer) {
  return offer.discountType === "percent" ? `${offer.discountValue}% OFF` : `₹${offer.discountValue} OFF`
}

function formatExpiry(endsAt?: string | null) {
  if (!endsAt) return null
  const date = new Date(endsAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function salonOfferCaption(offer: SalonOffer) {
  const parts: string[] = [salonDiscountLabel(offer)]
  if (offer.appliesTo === "all_services") {
    parts.push("All services")
  } else if (offer.appliesTo === "selected_services") {
    parts.push("Selected services")
  }
  if (offer.minOrderRupees != null && offer.minOrderRupees > 0) {
    parts.push(`Min ₹${offer.minOrderRupees}`)
  }
  const expiry = formatExpiry(offer.endsAt)
  if (expiry) parts.push(`Till ${expiry}`)
  return parts.join(" · ")
}

function servicesLine(offer: SalonOffer) {
  if (offer.appliesTo === "all_services") return "All services"
  if (offer.appliesTo === "selected_services") return "Selected services"
  return "Salon offer"
}

const SALON_PASTEL: Pastel = pastels.peach

export function SalonOffersCarousel({ salonOffers, contentInset = sp.gutter, onPressCta }: Props) {
  const { width: windowWidth } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const [activeOfferKey, setActiveOfferKey] = useState<string | null>(null)

  const items = useMemo<DisplayOffer[]>(() => {
    const next: DisplayOffer[] = [
      ...salonOffers.map((offer) => ({
        key: `s-${offer.id}`,
        kind: "salon" as const,
        offer,
      })),
    ]
    return next
  }, [salonOffers])

  const gap = 12
  // A second card peeks in when there is more than one.
  const cardWidth =
    items.length > 1
      ? Math.max(260, windowWidth - contentInset * 2 - 28)
      : Math.max(260, windowWidth - contentInset * 2)
  const snap = cardWidth + gap
  const activeOffer = items.find((item) => item.key === activeOfferKey) ?? null

  if (items.length === 0) return null

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(snap, 1))
    setIndex(Math.max(0, Math.min(next, items.length - 1)))
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={items.length > 1 ? snap : undefined}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={[styles.row, { paddingHorizontal: contentInset }]}
        onMomentumScrollEnd={onMomentumEnd}
      >
        {items.map((item) => (
          <OfferCard
            key={item.key}
            width={cardWidth}
            pastel={SALON_PASTEL}
            glyph={item.offer.discountType === "percent" ? "%" : undefined}
            icon="pricetag"
            eyebrow="Salon offer"
            badge={salonDiscountLabel(item.offer)}
            title={item.offer.title}
            lines={[
              servicesLine(item.offer),
              formatExpiry(item.offer.endsAt) ? `Valid till ${formatExpiry(item.offer.endsAt)}` : null,
            ]}
            accessibilityLabel={`${salonOfferCaption(item.offer)}. ${item.offer.title}. Opens offer details`}
            onPress={() => setActiveOfferKey(item.key)}
            footer={item.offer.code ? <CodeChip code={item.offer.code} label="Code" /> : null}
          />
        ))}
      </ScrollView>

      <OfferDots count={items.length} index={index} />

      <BottomSheet
        visible={activeOffer != null}
        title="Offer details"
        onClose={() => setActiveOfferKey(null)}
        footer={
          activeOffer ? (
            <PrimaryPill
              label="Book now"
              onPress={() => {
                setActiveOfferKey(null)
                onPressCta?.()
              }}
            />
          ) : undefined
        }
      >
        {activeOffer ? (
          <View style={styles.sheetBody}>
            <PastelIcon pastel={SALON_PASTEL} name="pricetag" size={52} />
            <Text style={ui.sectionLabel}>{salonDiscountLabel(activeOffer.offer)}</Text>
            <Text style={styles.sheetTitle}>{activeOffer.offer.title}</Text>
            {activeOffer.offer.description ? (
              <Text style={styles.sheetText}>{activeOffer.offer.description}</Text>
            ) : null}
            {activeOffer.offer.code ? <CodeBlock code={activeOffer.offer.code} /> : null}
            <View style={styles.sheetFacts}>
              <Fact pastel={pastels.peach} icon="cut-outline" text={servicesLine(activeOffer.offer)} />
              <Fact
                pastel={pastels.lavender}
                icon="repeat-outline"
                text={
                  activeOffer.offer.customerEligibility === "new_customers_only"
                    ? "New customers only"
                    : "Available to all customers"
                }
              />
              <Fact pastel={pastels.mint} icon="checkmark-circle-outline" text="Once per customer" />
              {activeOffer.offer.minOrderRupees != null && activeOffer.offer.minOrderRupees > 0 ? (
                <Fact
                  pastel={pastels.gold}
                  icon="cash-outline"
                  text={`Minimum booking ₹${activeOffer.offer.minOrderRupees}`}
                />
              ) : null}
              {formatExpiry(activeOffer.offer.endsAt) ? (
                <Fact
                  pastel={pastels.sky}
                  icon="time-outline"
                  text={`Valid till ${formatExpiry(activeOffer.offer.endsAt)}`}
                />
              ) : null}
            </View>
            {activeOffer.offer.terms ? (
              <>
                <Text style={[ui.sectionLabel, styles.termsLabel]}>Terms</Text>
                <Text style={styles.sheetText}>{activeOffer.offer.terms}</Text>
              </>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <View style={styles.codeBlock}>
      <Text style={styles.codeLabel}>Promo code · tap to copy</Text>
      <CodeChip code={code} />
    </View>
  )
}

function Fact({ pastel, icon, text }: { pastel: Pastel; icon: IconName; text: string }) {
  return (
    <View style={styles.factRow}>
      <PastelIcon pastel={pastel} name={icon} size={32} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  row: {
    gap: 12,
  },
  sheetBody: {
    gap: 10,
  },
  sheetTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: sp.text,
  },
  sheetText: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.secondary,
  },
  codeBlock: {
    marginTop: 4,
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
  },
  codeLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: sp.secondary,
  },
  sheetFacts: {
    marginTop: 6,
    gap: 12,
  },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  factText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.text,
  },
  termsLabel: {
    marginTop: 12,
  },
})
