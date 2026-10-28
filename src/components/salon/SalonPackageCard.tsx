import { Image } from "expo-image"
import { Pressable, StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { SalonPackage } from "@/data/types"
import { resolvePackageBadge } from "@/lib/package-badges"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  pkg: SalonPackage
  imageFallback: string
  selected: boolean
  onPressDetails: () => void
  onToggleAdd: () => void
  style?: object
}

export function SalonPackageCard({
  pkg,
  imageFallback,
  selected,
  onPressDetails,
  onToggleAdd,
  style,
}: Props) {
  const badge = resolvePackageBadge(pkg.badge)
  const showCompare =
    pkg.showComparePrice !== false &&
    pkg.comparePrice > pkg.packagePrice &&
    pkg.packagePrice > 0
  const savings = showCompare ? pkg.comparePrice - pkg.packagePrice : 0
  const included = pkg.items.slice(0, 3)
  const remaining = Math.max(0, pkg.items.length - included.length)
  const serviceCount = pkg.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <Pressable
      onPress={onPressDetails}
      accessibilityRole="button"
      accessibilityLabel={`${pkg.name} package details`}
      style={({ pressed }) => [
        styles.card,
        style,
        selected && styles.cardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.coverWrap}>
        <Image
          source={{ uri: pkg.imageUrl || imageFallback }}
          style={styles.cover}
          contentFit="cover"
        />
        {badge ? (
          <View style={styles.badge}>
            <Text variant="caption" color={colors.text}>
              {badge.emoji} {badge.label}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text variant="heading" numberOfLines={2} style={styles.title}>
          {pkg.name}
        </Text>

        {pkg.shortDescription ? (
          <Text variant="caption" muted numberOfLines={2} style={styles.tagline}>
            {pkg.shortDescription}
          </Text>
        ) : null}

        {included.length > 0 ? (
          <View style={styles.includes}>
            {included.map((item) => (
              <View
                key={`${pkg.id}-${item.serviceId}`}
                style={styles.includeRow}
              >
                <Icon name="checkmark" size={14} color={colors.success} />
                <Text variant="caption" numberOfLines={1} style={styles.includeText}>
                  {item.quantity > 1 ? `${item.quantity}× ` : ""}
                  {item.serviceName}
                </Text>
              </View>
            ))}
            {remaining > 0 ? (
              <Text variant="caption" color={colors.primary} style={styles.more}>
                +{remaining} more
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.metaRow}>
          {pkg.totalDurationMin > 0 ? (
            <View style={styles.metaChip}>
              <Icon name="time-outline" size={14} color={colors.textSubtle} />
              <Text variant="caption" muted>
                {pkg.totalDurationMin} min
              </Text>
            </View>
          ) : null}
          <View style={styles.metaChip}>
            <Icon name="layers-outline" size={14} color={colors.textSubtle} />
            <Text variant="caption" muted>
              {serviceCount || pkg.items.length || 1}{" "}
              {(serviceCount || pkg.items.length || 1) === 1 ? "service" : "services"}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.priceBlock}>
            <Text variant="heading">₹{pkg.packagePrice}</Text>
            {showCompare ? (
              <Text variant="caption" muted style={styles.strike}>
                ₹{pkg.comparePrice}
              </Text>
            ) : null}
            {savings > 0 ? (
              <View style={styles.savePill}>
                <Text variant="caption" color={colors.success}>
                  Save ₹{savings}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onPressDetails}
              style={({ pressed }) => [
                styles.detailsBtn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`View ${pkg.name} details`}
            >
              <Text variant="caption" color={colors.text}>
                Details
              </Text>
            </Pressable>
            <Pressable
              onPress={(event) => {
                event.stopPropagation?.()
                onToggleAdd()
              }}
              style={({ pressed }) => [
                styles.addBtn,
                selected && styles.addBtnSelected,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                selected ? `Remove ${pkg.name}` : `Add ${pkg.name}`
              }
            >
              <Text
                variant="caption"
                color={selected ? colors.text : colors.primaryFg}
              >
                {selected ? "Added" : "Add"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  cardSelected: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.94,
  },
  coverWrap: {
    width: "100%",
    aspectRatio: 16 / 10,
    backgroundColor: colors.muted,
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
  },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
  },
  tagline: {
    marginTop: -2,
  },
  includes: {
    marginTop: spacing.xs,
    gap: 6,
  },
  includeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  includeText: {
    flex: 1,
    minWidth: 0,
  },
  more: {
    paddingLeft: 22,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  priceBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  strike: {
    textDecorationLine: "line-through",
  },
  savePill: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: "rgba(31,122,77,0.1)",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  detailsBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnSelected: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
})
