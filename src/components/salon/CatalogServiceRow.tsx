import { Image } from "expo-image"
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native"

import {
  ServiceQuantityStepper,
  serviceUsesQuantity,
} from "@/components/salon/ServiceQuantityStepper"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { SalonService } from "@/data/types"
import {
  defaultPriceOptionId,
  formatServicePriceLabel,
  serviceHasPriceOptions,
} from "@/lib/service-pricing"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  service: SalonService
  selected: boolean
  quantity: number
  selectedOptionId?: string | null
  offerLabel?: string
  isLast?: boolean
  onOpenDetail: () => void
  onToggle: () => void
  onQuantityChange: (quantity: number) => void
  onPriceOptionChange: (optionId: string) => void
  onLayout?: (event: LayoutChangeEvent) => void
}

export function CatalogServiceRow({
  service,
  selected,
  quantity,
  selectedOptionId = null,
  offerLabel,
  isLast = false,
  onOpenDetail,
  onToggle,
  onQuantityChange,
  onPriceOptionChange,
  onLayout,
}: Props) {
  const hasOptions = serviceHasPriceOptions(service)
  const priceOptions = service.priceOptions ?? []
  const activeOptionId = selectedOptionId || defaultPriceOptionId(service) || ""
  const showQuantity = selected && serviceUsesQuantity(service)
  const thumbUrl = service.imageUrl.trim()

  function handleAdd() {
    if (hasOptions && activeOptionId) {
      onPriceOptionChange(activeOptionId)
      return
    }
    onToggle()
  }

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.row,
        selected && styles.rowSelected,
        isLast && styles.rowLast,
      ]}
    >
      <View style={styles.top}>
        <Pressable
          style={styles.main}
          onPress={onOpenDetail}
          accessibilityRole="button"
          accessibilityLabel={`${service.name} details`}
        >
          {thumbUrl ? (
            <Image
              source={{ uri: thumbUrl }}
              style={styles.thumb}
              contentFit="cover"
            />
          ) : null}
          <View style={styles.copy}>
            <View style={styles.nameRow}>
              <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                {service.name}
              </Text>
              {offerLabel ? (
                <View style={styles.offerBadge}>
                  <Text
                    variant="caption"
                    color={colors.coral}
                    style={styles.offerBadgeLabel}
                  >
                    {offerLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            {service.description ? (
              <Text variant="caption" muted numberOfLines={1}>
                {service.description}
              </Text>
            ) : (
              <Text variant="caption" muted numberOfLines={1}>
                {service.category}
              </Text>
            )}
            <View style={styles.meta}>
              <Icon name="time-outline" size={13} color={colors.textSubtle} />
              <Text variant="caption" muted>
                {service.durationMin} min
              </Text>
              <Text variant="caption" muted>
                ·
              </Text>
              <Text variant="caption" color={colors.text}>
                {formatServicePriceLabel(
                  service,
                  selected && hasOptions ? activeOptionId : undefined,
                  { finalPrice: selected && hasOptions },
                )}
              </Text>
              {service.compareAtPrice ? (
                <Text variant="caption" muted style={styles.strike}>
                  ₹{service.compareAtPrice}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>

        {showQuantity ? (
          <ServiceQuantityStepper
            service={service}
            quantity={quantity}
            onQuantityChange={onQuantityChange}
            onRemove={onToggle}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selected ? "Remove from bag" : "Add to bag"}
            onPress={selected ? onToggle : handleAdd}
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
        )}
      </View>

      {hasOptions ? (
        <View style={styles.options}>
          <Text variant="caption" muted>
            Choose a price
          </Text>
          {priceOptions.map((option) => {
            const active = selected && activeOptionId === option.id
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onPriceOptionChange(option.id)}
                style={[styles.optionChip, active && styles.optionChipActive]}
              >
                <Text variant="caption" color={active ? colors.coral : colors.text}>
                  {option.name}
                </Text>
                <Text variant="caption" color={active ? colors.coral : colors.text}>
                  ₹{Math.round(option.price)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}
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
    gap: spacing.sm,
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minWidth: 0,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  offerBadge: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: "#FFF7F5",
  },
  offerBadgeLabel: {
    fontSize: 10,
    lineHeight: 14,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    flexWrap: "wrap",
  },
  strike: {
    textDecorationLine: "line-through",
  },
  addBtn: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnSelected: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  addBtnLabel: {
    fontSize: 13,
  },
  options: {
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionChipActive: {
    borderColor: colors.coral,
    backgroundColor: "#FFF7F5",
  },
})
