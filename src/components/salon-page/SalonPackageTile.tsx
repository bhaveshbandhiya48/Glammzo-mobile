import { Pressable, StyleSheet, View } from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import { Text } from "@/components/ui/Text"
import type { SalonPackage } from "@/data/types"
import { formatDuration } from "@/lib/booking-display"
import { resolvePackageBadge } from "@/lib/package-badges"
import { formatRupees } from "@/lib/service-pricing"
import { fontFamily } from "@/theme/tokens"

import { PACKAGE_PASTELS, sp, ui } from "./theme"

type Props = {
  pkg: SalonPackage
  index: number
  selected: boolean
  onOpen: () => void
  onToggle: () => void
}

export function packageItemsLine(pkg: SalonPackage): string {
  const items = pkg.items.map((item) => (item.quantity > 1 ? `${item.quantity}× ${item.serviceName}` : item.serviceName))
  const parts = items.length > 0 ? items : pkg.shortDescription ? [pkg.shortDescription] : []
  if (pkg.totalDurationMin > 0) parts.push(formatDuration(pkg.totalDurationMin))
  return parts.join(" · ")
}

/** Pastel package card: badge, name, items · duration, price, Add package. */
export function SalonPackageTile({ pkg, index, selected, onOpen, onToggle }: Props) {
  const pastel = PACKAGE_PASTELS[index % PACKAGE_PASTELS.length]!
  const badge = resolvePackageBadge(pkg.badge)?.label ?? (pkg.isFeatured ? "Most booked" : null)
  const showCompare = pkg.showComparePrice !== false && pkg.comparePrice > pkg.packagePrice

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pkg.name} package details`}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && ui.pressed]}
    >
      <GradientFill colors={pastel.gradient} angle={150} radius={20} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={styles.name}>{pkg.name}</Text>
      {packageItemsLine(pkg) ? (
        <Text style={styles.items} numberOfLines={2}>
          {packageItemsLine(pkg)}
        </Text>
      ) : null}
      <View style={styles.footer}>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatRupees(pkg.packagePrice)}</Text>
          {showCompare ? <Text style={[styles.items, ui.strike]}>{formatRupees(pkg.comparePrice)}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selected ? `Remove ${pkg.name} from bag` : `Add ${pkg.name} to bag`}
          accessibilityState={{ selected }}
          hitSlop={6}
          onPress={onToggle}
          style={({ pressed }) => [selected ? ui.addedPill : ui.blackPill, pressed && ui.pressed]}
        >
          <Text style={selected ? ui.addedPillText : ui.blackPillText}>{selected ? "✓ Added" : "Add package"}</Text>
        </Pressable>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
    gap: 6,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
    marginBottom: 2,
  },
  badgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 15,
    color: "#6b4f12",
  },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 21,
    color: sp.text,
  },
  items: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: sp.label,
  },
  footer: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexShrink: 1,
  },
  price: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 21,
    color: sp.text,
  },
})
