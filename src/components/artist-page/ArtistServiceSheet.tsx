import { Pressable, StyleSheet, View } from "react-native"

import { sp, ui } from "@/components/salon-page/theme"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Text } from "@/components/ui/Text"
import type { PublicArtistService } from "@/lib/artists-api"
import { formatDuration } from "@/lib/booking-display"
import { formatRupees } from "@/lib/service-pricing"
import { fontFamily } from "@/theme/tokens"

import { artistServiceLocationLabel } from "./ArtistServiceRow"

type Props = {
  service: PublicArtistService | null
  selected: boolean
  onClose: () => void
  onToggle: (service: PublicArtistService) => void
}

/** Service summary in the salon sheet style: price at the studio, home-visit price, offer, add/remove. */
export function ArtistServiceSheet({ service, selected, onClose, onToggle }: Props) {
  const hasOffer = service != null && service.offerPrice != null && service.offerPrice < service.price
  const homeVisits = service != null && (service.locationMode === "client_home" || service.locationMode === "both")

  return (
    <BottomSheet visible={service != null} title="Service summary" onClose={onClose}>
      {service ? (
        <View style={styles.wrap}>
          <Text style={styles.title}>{service.name}</Text>
          <Text style={styles.meta}>
            {[service.category || artistServiceLocationLabel(service.locationMode), formatDuration(service.durationMinutes)]
              .filter(Boolean)
              .join(" · ")}
          </Text>

          <View style={styles.priceCard}>
            <Text style={ui.sectionLabel}>At artist's studio</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatRupees(hasOffer ? service.offerPrice! : service.price)}</Text>
              {hasOffer ? <Text style={[styles.meta, ui.strike]}>{formatRupees(service.price)}</Text> : null}
            </View>
            {hasOffer && service.offerDealLabel ? (
              <View style={[ui.offerBadge, styles.offerBadge]}>
                <Text style={ui.offerBadgeText}>
                  {service.offerDealLabel}
                  {service.offerTitle ? ` · ${service.offerTitle}` : ""}
                </Text>
              </View>
            ) : null}
            {service.homeVisitPriceOverride != null ? (
              <View style={styles.homeRow}>
                <Text style={ui.sectionLabel}>If artist comes to your home</Text>
                <Text style={styles.homePrice}>{formatRupees(service.homeVisitPriceOverride)}</Text>
              </View>
            ) : homeVisits ? (
              <Text style={[styles.meta, { marginTop: 8 }]}>Same price for home visits</Text>
            ) : null}
          </View>

          {service.description?.trim() ? <Text style={[styles.body, { marginTop: 16 }]}>{service.description}</Text> : null}
          <Text style={[styles.meta, { marginTop: 12 }]}>{artistServiceLocationLabel(service.locationMode)}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onToggle(service)
              onClose()
            }}
            style={({ pressed }) => [styles.cta, selected && styles.ctaSecondary, pressed && ui.pressed]}
          >
            <Text style={[styles.ctaText, selected && styles.ctaTextSecondary]}>
              {selected ? "Remove from bag" : "Add to bag"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 8,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: sp.text,
  },
  meta: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: sp.secondary,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.body,
  },
  priceCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
  },
  priceRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  price: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
    color: sp.text,
  },
  offerBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  homeRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: sp.hairline,
    gap: 6,
  },
  homePrice: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 22,
    color: sp.text,
  },
  cta: {
    marginTop: 24,
    height: 50,
    borderRadius: 999,
    backgroundColor: sp.text,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaSecondary: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: sp.text,
  },
  ctaText: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 19,
    color: "#ffffff",
  },
  ctaTextSecondary: {
    color: sp.text,
  },
})
