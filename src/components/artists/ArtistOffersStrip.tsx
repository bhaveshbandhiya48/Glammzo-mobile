import { useMemo, useState } from "react"
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"

import { Text } from "@/components/ui/Text"
import type { PublicArtistOffer, PublicArtistService } from "@/lib/artists-api"
import type { GlammzoOfferCard } from "@/lib/glammzo-offers-api"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  artistOffers: PublicArtistOffer[]
  services: PublicArtistService[]
  glammzoOffers?: GlammzoOfferCard[]
  /** Horizontal inset already applied by parent screen padding. */
  contentInset?: number
}

type SliderItem =
  | { key: string; kind: "artist"; offer: PublicArtistOffer }
  | { key: string; kind: "glammzo"; offer: GlammzoOfferCard }

function appliesLabel(offer: PublicArtistOffer, services: PublicArtistService[]) {
  if (offer.appliesTo === "all_services") return "Applies to all services"
  const names = offer.serviceIds
    .map((id) => services.find((s) => s.id === id)?.name)
    .filter((name): name is string => Boolean(name?.trim()))
  if (names.length === 0) return "Applies to selected services"
  if (names.length <= 2) return `Applies to ${names.join(" · ")}`
  return `Applies to ${names.slice(0, 2).join(" · ")} +${names.length - 2} more`
}

function endsLabel(endsAt: string | null) {
  if (!endsAt) return null
  const date = new Date(endsAt)
  if (Number.isNaN(date.getTime())) return null
  return `Till ${date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`
}

/** Artist + Glammzo offers on the solo-artist detail page (slider when multiple). */
export function ArtistOffersStrip({
  artistOffers,
  services,
  glammzoOffers = [],
  contentInset = spacing.lg,
}: Props) {
  const { width: windowWidth } = useWindowDimensions()
  const [index, setIndex] = useState(0)

  const items = useMemo<SliderItem[]>(() => {
    return [
      ...artistOffers.map((offer) => ({
        key: `a-${offer.id}`,
        kind: "artist" as const,
        offer,
      })),
      ...glammzoOffers.map((offer) => ({
        key: `g-${offer.id}`,
        kind: "glammzo" as const,
        offer,
      })),
    ]
  }, [artistOffers, glammzoOffers])

  if (items.length === 0) return null

  const gap = spacing.md
  const cardWidth =
    items.length === 1
      ? Math.max(240, windowWidth - contentInset * 2)
      : Math.max(260, windowWidth - contentInset * 2 - spacing.xl)
  const snap = cardWidth + gap

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(snap, 1))
    setIndex(Math.max(0, Math.min(next, items.length - 1)))
  }

  return (
    <View style={styles.section}>
      <Text variant="heading">Offers</Text>

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={items.length > 1 ? snap : undefined}
        snapToAlignment="start"
        disableIntervalMomentum={items.length > 1}
        style={styles.scroller}
        contentContainerStyle={[
          styles.row,
          items.length === 1 ? styles.rowSingle : null,
        ]}
        onMomentumScrollEnd={items.length > 1 ? onMomentumEnd : undefined}
      >
        {items.map((item) => {
          if (item.kind === "artist") {
            const offer = item.offer
            const till = endsLabel(offer.endsAt)
            const how =
              offer.howToApply?.trim() ||
              (offer.code
                ? `Enter code ${offer.code} when you book.`
                : "Applied automatically when you book — no code needed.")
            return (
              <View key={item.key} style={[styles.card, { width: cardWidth }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text variant="bodyStrong" numberOfLines={2}>
                      {offer.title}
                    </Text>
                    {offer.description?.trim() ? (
                      <Text variant="caption" muted numberOfLines={3}>
                        {offer.description.trim()}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.dealBadge}>
                    <Text variant="caption" color={colors.primaryFg} style={styles.dealText}>
                      {offer.dealLabel}
                    </Text>
                  </View>
                </View>
                <Text variant="caption" muted style={styles.meta} numberOfLines={2}>
                  {appliesLabel(offer, services)}
                  {till ? ` · ${till}` : ""}
                </Text>
                <Text variant="caption" color={colors.primary} style={styles.how} numberOfLines={2}>
                  {how}
                </Text>
                {offer.code ? (
                  <Text variant="caption" style={styles.code}>
                    Code: {offer.code}
                  </Text>
                ) : null}
              </View>
            )
          }

          const offer = item.offer
          return (
            <View key={item.key} style={[styles.card, styles.cardGlammzo, { width: cardWidth }]}>
              <Text variant="caption" color={colors.primary}>
                {offer.eyebrow || "Glammzo offer"}
              </Text>
              <Text variant="bodyStrong" numberOfLines={2}>
                {offer.title}
              </Text>
              {offer.cashbackRupees > 0 ? (
                <Text variant="caption" muted>
                  ₹{offer.cashbackRupees} cashback
                  {offer.minOrderRupees > 0 ? ` · min ₹${offer.minOrderRupees}` : ""}
                </Text>
              ) : null}
              <Text variant="caption" color={colors.primary} style={styles.how} numberOfLines={2}>
                {offer.promoCode
                  ? `Enter code ${offer.promoCode} when you book. Cashback is added after your visit.`
                  : "Cashback is added to your wallet after your completed visit."}
              </Text>
              {offer.promoCode ? (
                <Text variant="caption" style={styles.code}>
                  Code: {offer.promoCode}
                </Text>
              ) : null}
            </View>
          )
        })}
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
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  scroller: {
    marginHorizontal: -spacing.lg,
    marginTop: spacing.xs,
  },
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  rowSingle: {
    paddingRight: spacing.lg,
  },
  card: {
    backgroundColor: "#F1F1F1",
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(232, 120, 90, 0.28)",
    padding: spacing.md,
    gap: 4,
    minHeight: 132,
  },
  cardGlammzo: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  dealBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    flexShrink: 0,
  },
  dealText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
  },
  meta: {
    marginTop: 2,
  },
  how: {
    marginTop: 2,
    fontWeight: "600",
  },
  code: {
    marginTop: 2,
    fontWeight: "700",
    color: colors.text,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },
})
