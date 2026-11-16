import { Pressable, StyleSheet, View } from "react-native"

import { AddPill } from "@/components/salon-page/SalonServiceRow"
import { sp, ui } from "@/components/salon-page/theme"
import { Text } from "@/components/ui/Text"
import { artistServiceUnitPrice, type PublicArtistService } from "@/lib/artists-api"
import { formatDuration } from "@/lib/booking-display"
import { formatRupees } from "@/lib/service-pricing"
import {
  artistMinQuantity,
  artistPriceLabel,
  artistPriceLine,
  artistQuantityLabel,
  artistServiceHasChoices,
  artistServiceOptions,
  artistUnitSuffix,
  defaultArtistChoice,
  MAX_ARTIST_QUANTITY,
  type ArtistServiceChoice,
} from "@/lib/artist-service-pricing"
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
  /** Booking step: the picked price option / finger count, shown as a chooser under the row. */
  choice?: ArtistServiceChoice
  onChoiceChange?: (patch: Partial<ArtistServiceChoice>) => void
}

/** Salon-style service row: name, where, duration, price and the same Add + / ✓ Added pill. */
export function ArtistServiceRow({ service, selected, isLast = false, onOpenDetail, onToggle, choice, onChoiceChange }: Props) {
  const { studioPrice, homePrice, offerPrice } = artistServicePrices(service)
  const description = service.description?.trim()
  const hasChoices = artistServiceHasChoices(service)
  const showPicker = selected && hasChoices && Boolean(onChoiceChange)
  const line = artistPriceLine(service, choice ?? defaultArtistChoice(service))

  return (
    <View style={!isLast && styles.divider}>
    <View style={styles.row}>
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
        {service.durationMinutes > 0 ? (
          <Text style={styles.meta}>
            {formatDuration(showPicker ? line.durationMinutes : service.durationMinutes)}
            {showPicker && line.detail ? ` · ${line.detail}` : ""}
          </Text>
        ) : null}
        <View style={styles.priceRow}>
          {hasChoices ? (
            <Text style={styles.price}>{showPicker ? formatRupees(line.total) : artistPriceLabel(service)}</Text>
          ) : (
            <>
              <Text style={styles.price}>{formatRupees(offerPrice ?? studioPrice)}</Text>
              {offerPrice != null ? <Text style={[styles.meta, ui.strike]}>{formatRupees(studioPrice)}</Text> : null}
            </>
          )}
        </View>
        {homePrice != null && !hasChoices ? (
          <Text style={styles.meta} numberOfLines={1}>
            {formatRupees(homePrice)} if the artist visits you
          </Text>
        ) : null}
      </Pressable>

      <AddPill added={selected} label={service.name} onPress={onToggle} />
    </View>
    {showPicker ? (
      <ArtistChoicePicker service={service} choice={choice ?? defaultArtistChoice(service)} onChange={onChoiceChange!} />
    ) : null}
    </View>
  )
}

/** Pick one of several prices and / or how many fingers or hands. */
function ArtistChoicePicker({
  service,
  choice,
  onChange,
}: {
  service: PublicArtistService
  choice: ArtistServiceChoice
  onChange: (patch: Partial<ArtistServiceChoice>) => void
}) {
  const options = artistServiceOptions(service)
  const line = artistPriceLine(service, choice)
  const unit = line.unit
  const min = artistMinQuantity(service)
  const max = unit ? MAX_ARTIST_QUANTITY[unit] : 1
  return (
    <View style={styles.picker}>
      {options.length > 0 ? (
        <View style={styles.optionList} accessibilityRole="radiogroup">
          {options.map((option) => {
            const on = choice.priceOptionId === option.id
            return (
              <Pressable
                key={option.id}
                onPress={() => onChange({ priceOptionId: option.id })}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${option.name}, ${formatRupees(option.price)}`}
                style={[styles.option, on && styles.optionOn]}
              >
                <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                <View style={styles.main}>
                  <Text style={styles.optionName}>{option.name}</Text>
                  <Text style={styles.meta}>{formatDuration(option.durationMinutes)}</Text>
                </View>
                <Text style={styles.price}>
                  {formatRupees(option.price)}
                  {unit ? <Text style={styles.meta}> {artistUnitSuffix(unit)}</Text> : null}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}
      {unit ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.meta}>How many {unit === "per_finger" ? "fingers" : "hands"}?</Text>
          <View style={styles.stepRow}>
            <Pressable
              onPress={() => onChange({ quantity: Math.max(min, line.quantity - 1) })}
              disabled={line.quantity <= min}
              accessibilityRole="button"
              accessibilityLabel="Fewer"
              style={[styles.stepBtn, line.quantity <= min && styles.stepOff]}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={[styles.optionName, styles.stepValue]} accessibilityLiveRegion="polite">
              {artistQuantityLabel(unit, line.quantity)}
            </Text>
            <Pressable
              onPress={() => onChange({ quantity: Math.min(max, line.quantity + 1) })}
              disabled={line.quantity >= max}
              accessibilityRole="button"
              accessibilityLabel="More"
              style={[styles.stepBtn, line.quantity >= max && styles.stepOff]}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
            <Text style={[styles.meta, styles.stepMath]}>× {formatRupees(line.unitPrice)}</Text>
          </View>
          {unit === "per_finger" ? (
            <View style={styles.quickRow}>
              {[5, 10].filter((n) => n >= min).map((n) => (
                <Pressable
                  key={n}
                  onPress={() => onChange({ quantity: n })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: line.quantity === n }}
                  style={[styles.quick, line.quantity === n && styles.quickOn]}
                >
                  <Text style={styles.quickText}>{n === 5 ? "One hand (5)" : "Both hands (10)"}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
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
  picker: {
    gap: 12,
    marginBottom: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: sp.grey,
  },
  optionList: { gap: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
  },
  optionOn: { borderColor: sp.text, borderWidth: 1.5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: sp.secondary, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: sp.text },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: sp.text },
  optionName: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 19, color: sp.text },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: sp.border, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  stepOff: { opacity: 0.4 },
  stepText: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 24, color: sp.text },
  stepValue: { minWidth: 84, textAlign: "center" },
  stepMath: { marginLeft: "auto" },
  quickRow: { flexDirection: "row", gap: 8 },
  quick: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: sp.border, backgroundColor: "#ffffff" },
  quickOn: { borderColor: sp.text },
  quickText: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, color: sp.text },
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
