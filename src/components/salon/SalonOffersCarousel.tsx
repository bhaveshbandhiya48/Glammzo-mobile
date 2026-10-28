import { useMemo, useState } from "react"
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"

import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { SalonOffer } from "@/data/types"
import type { GlammzoOfferCard } from "@/lib/glammzo-offers-api"
import { colors, radii, spacing } from "@/theme/tokens"

type DisplayOffer =
  | {
      key: string
      kind: "glammzo"
      offer: GlammzoOfferCard
    }
  | {
      key: string
      kind: "salon"
      offer: SalonOffer
    }

type Props = {
  glammzoOffers: GlammzoOfferCard[]
  salonOffers: SalonOffer[]
  /** Horizontal inset already applied by parent screen padding. */
  contentInset?: number
  onPressCta?: () => void
}

function salonDiscountLabel(offer: SalonOffer) {
  return offer.discountType === "percent"
    ? `${offer.discountValue}% OFF`
    : `₹${offer.discountValue} OFF`
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

export function SalonOffersCarousel({
  glammzoOffers,
  salonOffers,
  contentInset = spacing.xl,
  onPressCta,
}: Props) {
  const { width: windowWidth } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const [activeOfferKey, setActiveOfferKey] = useState<string | null>(null)

  const items = useMemo<DisplayOffer[]>(() => {
    const next: DisplayOffer[] = [
      ...glammzoOffers.map((offer) => ({
        key: `g-${offer.id}`,
        kind: "glammzo" as const,
        offer,
      })),
      ...salonOffers.map((offer) => ({
        key: `s-${offer.id}`,
        kind: "salon" as const,
        offer,
      })),
    ]
    return next
  }, [glammzoOffers, salonOffers])

  const cardWidth = Math.max(260, windowWidth - contentInset * 2)
  const gap = spacing.md
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
        snapToInterval={snap}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={[
          styles.row,
          items.length === 1 ? styles.rowSingle : null,
        ]}
        onMomentumScrollEnd={onMomentumEnd}
      >
        {items.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.key}
            onPress={() => setActiveOfferKey(item.key)}
            style={[
              styles.card,
              { width: cardWidth },
              item.kind === "glammzo" ? styles.cardGlammzo : styles.cardSalon,
            ]}
          >
            {item.kind === "glammzo" ? (
              <>
                <View style={[styles.icon, styles.iconGlammzo]}>
                  <Icon name="sparkles" size={20} color={colors.primaryFg} />
                </View>
                <View style={styles.copy}>
                  <Text variant="label" color={colors.textMuted}>
                    {item.offer.eyebrow || "Glammzo offer"}
                  </Text>
                  <Text variant="bodyStrong" numberOfLines={2}>
                    {item.offer.title}
                  </Text>
                  <Text variant="caption" muted numberOfLines={2}>
                    {item.offer.cashbackRupees > 0
                      ? `₹${item.offer.cashbackRupees} wallet cashback after visit${
                          item.offer.minOrderRupees > 0
                            ? ` (min ₹${item.offer.minOrderRupees})`
                            : ""
                        }`
                      : item.offer.subtitle || "Glammzo offer"}
                  </Text>
                  {item.offer.promoCode ? (
                    <Text variant="caption" color={colors.text} style={styles.code}>
                      Code: {item.offer.promoCode}
                    </Text>
                  ) : null}
                </View>
              </>
            ) : (
              <>
                <View style={[styles.icon, styles.iconSalon]}>
                  {item.offer.discountType === "percent" ? (
                    <Text variant="heading" color={colors.primaryFg}>
                      %
                    </Text>
                  ) : (
                    <Icon name="pricetag" size={20} color={colors.primaryFg} />
                  )}
                </View>
                <View style={styles.copy}>
                  <Text variant="caption" color={colors.primary} style={styles.code}>
                    {salonDiscountLabel(item.offer)}
                  </Text>
                  <Text variant="bodyStrong" numberOfLines={2}>
                    {item.offer.title}
                  </Text>
                  <Text variant="caption" muted numberOfLines={2}>
                    {servicesLine(item.offer)}
                  </Text>
                  {item.offer.code ? (
                    <Text variant="caption" color={colors.text} numberOfLines={1}>
                      Code: {item.offer.code}
                    </Text>
                  ) : null}
                  {formatExpiry(item.offer.endsAt) ? (
                    <Text variant="caption" muted numberOfLines={1}>
                      Valid till {formatExpiry(item.offer.endsAt)}
                    </Text>
                  ) : null}
                </View>
              </>
            )}
          </Pressable>
        ))}
      </ScrollView>

      {items.length > 1 ? (
        <View style={styles.dots}>
          {items.map((item, i) => (
            <View
              key={item.key}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}

      <BottomSheet
        visible={activeOffer != null}
        title="Offer details"
        onClose={() => setActiveOfferKey(null)}
        footer={
          activeOffer ? (
            <Button
              label={
                activeOffer.kind === "salon"
                  ? activeOffer.offer.ctaLabel?.trim() || "Book now"
                  : activeOffer.offer.ctaLabel?.trim() || "Book now"
              }
              onPress={() => {
                setActiveOfferKey(null)
                onPressCta?.()
              }}
            />
          ) : undefined
        }
      >
        {activeOffer ? (
          activeOffer.kind === "glammzo" ? (
            <View style={styles.sheetBody}>
              <View style={[styles.sheetHero, styles.iconGlammzo]}>
                <Icon name="sparkles" size={24} color={colors.primaryFg} />
              </View>
              <Text variant="label" muted>
                {activeOffer.offer.eyebrow || "Glammzo offer"}
              </Text>
              <Text variant="heading">{activeOffer.offer.title}</Text>
              {activeOffer.offer.promoCode ? (
                <View style={styles.sheetCode}>
                  <Text variant="caption" muted>
                    Promo code
                  </Text>
                  <Text variant="bodyStrong">{activeOffer.offer.promoCode}</Text>
                </View>
              ) : null}
              {activeOffer.offer.description ? (
                <Text muted>{activeOffer.offer.description}</Text>
              ) : activeOffer.offer.subtitle ? (
                <Text muted>{activeOffer.offer.subtitle}</Text>
              ) : null}
              <View style={styles.sheetFacts}>
                {activeOffer.offer.cashbackRupees > 0 ? (
                  <View style={styles.factRow}>
                    <Icon name="wallet-outline" size={18} color={colors.primary} />
                    <Text style={{ flex: 1 }}>
                      ₹{activeOffer.offer.cashbackRupees} cashback after visit
                    </Text>
                  </View>
                ) : null}
                {activeOffer.offer.minOrderRupees > 0 ? (
                  <View style={styles.factRow}>
                    <Icon name="pricetag-outline" size={18} color={colors.primary} />
                    <Text style={{ flex: 1 }}>
                      Minimum booking ₹{activeOffer.offer.minOrderRupees}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.sheetBody}>
              <View style={[styles.sheetHero, styles.iconSalon]}>
                <Icon name="pricetag" size={24} color={colors.primaryFg} />
              </View>
              <Text variant="label" color={colors.primary}>
                {salonDiscountLabel(activeOffer.offer)}
              </Text>
              <Text variant="heading">{activeOffer.offer.title}</Text>
              {activeOffer.offer.description ? (
                <Text muted>{activeOffer.offer.description}</Text>
              ) : null}
              {activeOffer.offer.code ? (
                <View style={styles.sheetCode}>
                  <Text variant="caption" muted>
                    Promo code
                  </Text>
                  <Text variant="bodyStrong">{activeOffer.offer.code}</Text>
                </View>
              ) : null}
              <View style={styles.sheetFacts}>
                <View style={styles.factRow}>
                  <Icon name="cut-outline" size={18} color={colors.primary} />
                  <Text style={{ flex: 1 }}>{servicesLine(activeOffer.offer)}</Text>
                </View>
                <View style={styles.factRow}>
                  <Icon name="repeat-outline" size={18} color={colors.primary} />
                  <Text style={{ flex: 1 }}>
                    {activeOffer.offer.customerEligibility === "new_customers_only"
                      ? "New customers only"
                      : "Available to all customers"}
                  </Text>
                </View>
                <View style={styles.factRow}>
                  <Icon name="checkmark-circle-outline" size={18} color={colors.primary} />
                  <Text style={{ flex: 1 }}>Once per customer</Text>
                </View>
                {activeOffer.offer.minOrderRupees != null &&
                activeOffer.offer.minOrderRupees > 0 ? (
                  <View style={styles.factRow}>
                    <Icon name="cash-outline" size={18} color={colors.primary} />
                    <Text style={{ flex: 1 }}>
                      Minimum booking ₹{activeOffer.offer.minOrderRupees}
                    </Text>
                  </View>
                ) : null}
                {formatExpiry(activeOffer.offer.endsAt) ? (
                  <View style={styles.factRow}>
                    <Icon name="time-outline" size={18} color={colors.primary} />
                    <Text style={{ flex: 1 }}>
                      Valid till {formatExpiry(activeOffer.offer.endsAt)}
                    </Text>
                  </View>
                ) : null}
              </View>
              {activeOffer.offer.terms ? (
                <>
                  <Text variant="label" muted style={styles.sheetSectionLabel}>
                    Terms
                  </Text>
                  <Text muted>{activeOffer.offer.terms}</Text>
                </>
              ) : null}
            </View>
          )
        ) : null}
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  row: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  rowSingle: {
    paddingRight: 0,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 112,
  },
  cardSalon: {
    borderColor: "rgba(249, 92, 72, 0.25)",
    backgroundColor: "#F1F1F1",
  },
  cardGlammzo: {
    borderColor: "rgba(0,0,0,0.12)",
    backgroundColor: colors.surface,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconSalon: {
    backgroundColor: colors.primary,
  },
  iconGlammzo: {
    backgroundColor: colors.text,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  code: {
    letterSpacing: 0.8,
  },
  sheetBody: {
    gap: spacing.md,
  },
  sheetHero: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCode: {
    gap: 4,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sheetFacts: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  factRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  sheetSectionLabel: {
    marginTop: spacing.sm,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.sand,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },
})
