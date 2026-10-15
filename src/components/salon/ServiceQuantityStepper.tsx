import { Pressable, StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import {
  maxQuantityForPricingUnit,
  parsePricingUnit,
  pricingUnitQuantityLabel,
  pricingUnitUsesQuantity,
  quantityForService,
} from "@/lib/pricing-unit"
import { colors, radii, spacing } from "@/theme/tokens"
import type { SalonService } from "@/data/types"

type Props = {
  service: Pick<SalonService, "id" | "pricingUnit">
  quantity?: number
  onQuantityChange: (quantity: number) => void
  onRemove?: () => void
  showLabel?: boolean
}

export function serviceUsesQuantity(service: Pick<SalonService, "pricingUnit">) {
  return pricingUnitUsesQuantity(parsePricingUnit(service.pricingUnit))
}

export function ServiceQuantityStepper({
  service,
  quantity,
  onQuantityChange,
  onRemove,
  showLabel = false,
}: Props) {
  const unit = parsePricingUnit(service.pricingUnit)
  if (!pricingUnitUsesQuantity(unit)) return null

  const value = quantityForService(service, { [service.id]: quantity ?? 1 })
  const max = maxQuantityForPricingUnit(unit)
  const atMin = value <= 1
  const atMax = max != null && value >= max
  const minusRemoves = Boolean(onRemove) && atMin

  return (
    <View style={styles.row}>
      {showLabel ? (
        <Text variant="caption" muted>
          {pricingUnitQuantityLabel(unit)}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={minusRemoves ? "Remove" : "Decrease quantity"}
        disabled={atMin && !onRemove}
        onPress={() => {
          if (minusRemoves) {
            onRemove?.()
            return
          }
          onQuantityChange(Math.max(1, value - 1))
        }}
        style={[styles.btn, atMin && !onRemove && styles.btnDisabled]}
      >
        <Icon name="remove" size={14} color={colors.text} />
      </Pressable>
      <Text variant="caption" style={styles.value}>
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        disabled={atMax}
        onPress={() => onQuantityChange(max == null ? value + 1 : Math.min(max, value + 1))}
        style={[styles.btn, atMax && styles.btnDisabled]}
      >
        <Icon name="add" size={14} color={colors.text} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  btn: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    opacity: 0.35,
  },
  value: {
    minWidth: 18,
    textAlign: "center",
  },
})
