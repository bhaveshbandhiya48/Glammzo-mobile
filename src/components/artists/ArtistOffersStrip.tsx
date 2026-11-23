import { useMemo, useState } from "react"
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"

import { OfferCard, OfferDots } from "@/components/salon-page/OfferCard"
import { pastels, sp, ui } from "@/components/salon-page/theme"
import { CodeChip } from "@/components/ui/CodeChip"
import { Text } from "@/components/ui/Text"
import type { PublicArtistOffer, PublicArtistService } from "@/lib/artists-api"
import { copyCode } from "@/lib/copy-code"
import { AppOffersOnPage } from "@/components/app-offers/AppOffersOnPage"
import type { AppOffer } from "@/lib/app-offers-api"
import { fontFamily } from "@/theme/tokens"

type Props = {
  artistOffers: PublicArtistOffer[]
  services: PublicArtistService[]
  /** Glammzo offers that work with this artist, shown first as tickets. */
  appOffers?: AppOffer[]
  /** Opens the services list from an offer's details. */
  onBook?: () => void
  /** Horizontal inset already applied by parent screen padding. */
  contentInset?: number
}

type SliderItem = { key: string; kind: "artist"; offer: PublicArtistOffer }

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

/** Glammzo offers (tickets) and the artist's own offers (slider) on the artist page. */
export function ArtistOffersStrip({
  artistOffers,
  services,
  appOffers = [],
  onBook,
  contentInset = 16,
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
    ]
  }, [artistOffers])

  if (items.length === 0 && appOffers.length === 0) return null

  const gap = 12
  const cardWidth =
    items.length === 1
      ? Math.max(240, windowWidth - contentInset * 2)
      : Math.max(260, windowWidth - contentInset * 2 - 28)
  const snap = cardWidth + gap

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(snap, 1))
    setIndex(Math.max(0, Math.min(next, items.length - 1)))
  }

  return (
    <View style={styles.section}>
      <Text style={ui.sectionLabel} accessibilityRole="header">
        Offers
      </Text>

      <AppOffersOnPage offers={appOffers} onBook={onBook} />

      {items.length > 0 ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={items.length > 1 ? snap : undefined}
          snapToAlignment="start"
          disableIntervalMomentum={items.length > 1}
          style={{ marginHorizontal: -contentInset }}
          contentContainerStyle={[styles.row, { paddingHorizontal: contentInset }]}
          onMomentumScrollEnd={items.length > 1 ? onMomentumEnd : undefined}
        >
          {items.map((item) => {
            const offer = item.offer
            const till = endsLabel(offer.endsAt)
            const how =
              offer.howToApply?.trim() ||
              (offer.code
                ? `Enter code ${offer.code} when you book.`
                : "Applied automatically when you book — no code needed.")
            return (
              <OfferCard
                key={item.key}
                width={cardWidth}
                pastel={pastels.pink}
                icon="pricetag"
                eyebrow="Artist offer"
                badge={offer.dealLabel}
                title={offer.title}
                lines={[`${appliesLabel(offer, services)}${till ? ` · ${till}` : ""}`]}
                accessible
                accessibilityLabel={`${offer.dealLabel} ${offer.title}. ${appliesLabel(offer, services)}${till ? `, ${till}` : ""}. ${how}`}
                accessibilityActions={
                  offer.code ? [{ name: "copy", label: `Copy code ${offer.code}` }] : undefined
                }
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === "copy" && offer.code) copyCode(offer.code)
                }}
                footer={
                  offer.code ? (
                    <CodeChip code={offer.code} label="Code" />
                  ) : (
                    <Text style={styles.auto}>Applied automatically</Text>
                  )
                }
              />
            )
          })}
        </ScrollView>
      ) : null}

      {items.length > 1 ? <OfferDots count={items.length} index={index} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  row: { gap: 12 },
  auto: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: sp.text,
  },
})
