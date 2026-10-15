import { Pressable, StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import {
  artistServiceUnitPrice,
  type ArtistLocationType,
  type PublicArtistService,
} from "@/lib/artists-api"
import { formatRupees } from "@/lib/service-pricing"
import { colors, radii, spacing } from "@/theme/tokens"

function locationLabel(mode: PublicArtistService["locationMode"]) {
  if (mode === "both") return "Studio or home visit"
  if (mode === "studio") return "At artist's studio"
  return "Artist comes to you"
}

type Props = {
  service: PublicArtistService
  selected: boolean
  isLast?: boolean
  /** When set, row shows the price for that visit location. */
  pricingLocation?: ArtistLocationType
  onOpenDetail: () => void
  onToggle: () => void
}

export function ArtistServiceRow({
  service,
  selected,
  isLast = false,
  pricingLocation = "studio",
  onOpenDetail,
  onToggle,
}: Props) {
  const unitPrice = artistServiceUnitPrice(service, pricingLocation)
  const studioPrice = artistServiceUnitPrice(service, "studio")
  const homePrice =
    service.homeVisitPriceOverride != null
      ? artistServiceUnitPrice(service, "client_home")
      : null
  const showHomeHint =
    pricingLocation === "studio" &&
    homePrice != null &&
    homePrice !== studioPrice

  return (
    <View style={[styles.row, selected && styles.rowSelected, isLast && styles.rowLast]}>
      <View style={styles.top}>
        <Pressable
          style={styles.main}
          onPress={onOpenDetail}
          accessibilityRole="button"
          accessibilityLabel={`${service.name} details`}
        >
          <View style={styles.copy}>
            <Text variant="bodyStrong" numberOfLines={2}>
              {service.name}
            </Text>
            {service.description ? (
              <Text variant="caption" muted numberOfLines={1}>
                {service.description}
              </Text>
            ) : (
              <Text variant="caption" muted numberOfLines={1}>
                {locationLabel(service.locationMode)}
              </Text>
            )}
            <View style={styles.meta}>
              <Icon name="time-outline" size={13} color={colors.textSubtle} />
              <Text variant="caption" muted>
                {service.durationMinutes} min
              </Text>
              <Text variant="caption" muted>
                ·
              </Text>
              <Text variant="caption" color={colors.text}>
                {formatRupees(unitPrice)}
                {pricingLocation === "client_home" ? " at your place" : ""}
              </Text>
              {showHomeHint ? (
                <Text variant="caption" muted>
                  · {formatRupees(homePrice!)} if artist visits you
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selected ? "Remove from bag" : "Add to bag"}
          onPress={onToggle}
          style={[styles.addBtn, selected && styles.addBtnSelected]}
        >
          <Text
            variant="caption"
            color={selected ? colors.text : colors.primaryFg}
            style={styles.addBtnLabel}
          >
            {selected ? "Remove" : "Add"}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowSelected: {
    backgroundColor: "#FFF7F5",
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  copy: {
    gap: 2,
    minWidth: 0,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  addBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    minWidth: 72,
    alignItems: "center",
  },
  addBtnSelected: {
    backgroundColor: colors.muted,
  },
  addBtnLabel: {
    fontWeight: "600",
  },
})
