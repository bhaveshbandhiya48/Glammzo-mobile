import { Pressable, StyleSheet, View } from "react-native"

import { AddPill } from "@/components/salon-page/SalonServiceRow"
import { sp, ui } from "@/components/salon-page/theme"
import { Text } from "@/components/ui/Text"
import { artistServiceUnitPrice, type PublicArtistService } from "@/lib/artists-api"
import { formatDuration } from "@/lib/booking-display"
import { formatRupees } from "@/lib/service-pricing"
import { fontFamily } from "@/theme/tokens"

export function artistServiceLocationLabel(mode: PublicArtistService["locationMode"]) {
  if (mode === "both") return "Studio or home visit"
  if (mode === "studio") return "At artist's studio"
  return "Artist comes to you"
}

/** Studio price, the live offer price (when lower) and the home-visit price (when different). */
export function artistServicePrices(service: PublicArtistService) {
  const studioPrice = artistServiceUnitPrice(service, "studio")
  const homePrice = service.homeVisitPriceOverride != null ? artistServiceUnitPrice(service, "client_home") : null
  const offerPrice = service.offerPrice != null && service.offerPrice < studioPrice ? service.offerPrice : null
  return { studioPrice, homePrice: homePrice != null && homePrice !== studioPrice ? homePrice : null, offerPrice }
}

type Props = {
  service: PublicArtistService
  selected: boolean
  isLast?: boolean
  onOpenDetail: () => void
  onToggle: () => void
}

/** Salon-style service row: name, where, duration, price and the same Add + / ✓ Added pill. */
export function ArtistServiceRow({ service, selected, isLast = false, onOpenDetail, onToggle }: Props) {
  const { studioPrice, homePrice, offerPrice } = artistServicePrices(service)
  const description = service.description?.trim()

  return (
    <View style={[styles.row, !isLast && styles.divider]}>
      <Pressable
        style={styles.main}
        onPress={onOpenDetail}
        accessibilityRole="button"
        accessibilityLabel={`${service.name} details`}
      >
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={2}>
            {service.name}
          </Text>
          {offerPrice != null && service.offerDealLabel ? (
            <View style={ui.offerBadge}>
              <Text style={ui.offerBadgeText}>{service.offerDealLabel}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {description || artistServiceLocationLabel(service.locationMode)}
        </Text>
        {service.durationMinutes > 0 ? <Text style={styles.meta}>{formatDuration(service.durationMinutes)}</Text> : null}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatRupees(offerPrice ?? studioPrice)}</Text>
          {offerPrice != null ? <Text style={[styles.meta, ui.strike]}>{formatRupees(studioPrice)}</Text> : null}
        </View>
        {homePrice != null ? (
          <Text style={styles.meta} numberOfLines={1}>
            {formatRupees(homePrice)} if the artist visits you
          </Text>
        ) : null}
      </Pressable>

      <AddPill added={selected} label={service.name} onPress={onToggle} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: sp.hairline,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: sp.text,
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: sp.secondary,
  },
  priceRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  price: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    color: sp.text,
  },
})
