import { useMemo, useState } from "react"
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"

import { SectionHeader, sectionHeaderInline } from "@/components/detail/SectionHeader"
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
      <SectionHeader title="Offers" style={sectionHeaderInline} />

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
              <View
                key={item.key}
                style={[styles.card, { width: cardWidth }]}
                accessible
                accessibilityLabel={`${offer.dealLabel} ${offer.title}. ${appliesLabel(offer, services)}${till ? `, ${till}` : ""}. ${how}`}
              >
                <View style={styles.cardTop}>
                  <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                    {offer.title}
                  </Text>
                  <View style={styles.dealBadge}>
                    <Text variant="caption" color={colors.primaryFg} style={styles.dealText}>
                      {offer.dealLabel}
                    </Text>
                  </View>
                </View>
                <Text variant="caption" muted numberOfLines={1}>
                  {appliesLabel(offer, services)}
                  {till ? ` · ${till}` : ""}
                </Text>
                {offer.code ? (
                  <View style={styles.codeChip}>
                    <Text variant="caption" muted>
                      Code
                    </Text>
                    <Text variant="caption" style={styles.codeText}>
                      {offer.code}
                    </Text>
                  </View>
                ) : (
                  <Text variant="caption" muted>
                    Applied automatically
                  </Text>
                )}
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
              {offer.promoCode ? (
                <View style={styles.codeChip}>
                  <Text variant="caption" muted>
                    Code
                  </Text>
                  <Text variant="caption" style={styles.codeText}>
                    {offer.promoCode}
                  </Text>
                </View>
              ) : (
                <Text variant="caption" muted>
                  Cashback after your visit
                </Text>
              )}
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
  section: { gap: spacing.md },
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  codeChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.inputBorder,
  },
  codeText: {
    fontFamily: "Geist_700Bold",
    letterSpacing: 1,
    color: colors.text,
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
