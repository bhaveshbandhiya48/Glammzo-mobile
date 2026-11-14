import { Image } from "expo-image"
import { Pressable, StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { SalonService } from "@/data/types"
import { formatDuration } from "@/lib/booking-display"
import {
  maxQuantityForPricingUnit,
  parsePricingUnit,
  pricingUnitQuantityLabel,
  pricingUnitUsesQuantity,
  quantityForService,
} from "@/lib/pricing-unit"
import {
  defaultPriceOptionId,
  formatRupees,
  formatServicePriceLabel,
  serviceHasPriceOptions,
} from "@/lib/service-pricing"
import { fontFamily } from "@/theme/tokens"

import { sp, ui } from "./theme"

export function usesQuantity(service: Pick<SalonService, "pricingUnit">) {
  return pricingUnitUsesQuantity(parsePricingUnit(service.pricingUnit))
}

/** Nail unit stepper in the pill style: [− n +]. Minus at 1 removes when onRemove is set. */
export function QuantityPill({
  service,
  quantity,
  onQuantityChange,
  onRemove,
  showLabel = false,
}: {
  service: Pick<SalonService, "id" | "pricingUnit">
  quantity?: number
  onQuantityChange: (quantity: number) => void
  onRemove?: () => void
  showLabel?: boolean
}) {
  const unit = parsePricingUnit(service.pricingUnit)
  if (!pricingUnitUsesQuantity(unit)) return null
  const value = quantityForService(service, { [service.id]: quantity ?? 1 })
  const max = maxQuantityForPricingUnit(unit)
  const atMin = value <= 1
  const atMax = max != null && value >= max
  const minusRemoves = Boolean(onRemove) && atMin

  return (
    <View style={styles.qtyWrap}>
      {showLabel ? <Text style={styles.meta}>{pricingUnitQuantityLabel(unit)}</Text> : null}
      <View style={styles.qtyPill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={minusRemoves ? "Remove" : "Decrease quantity"}
          disabled={atMin && !onRemove}
          hitSlop={6}
          onPress={() => (minusRemoves ? onRemove?.() : onQuantityChange(Math.max(1, value - 1)))}
          style={[styles.qtyBtn, atMin && !onRemove && styles.disabled]}
        >
          <Icon name="remove" size={16} color={sp.peachInk} />
        </Pressable>
        <Text style={styles.qtyValue}>{value}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase quantity"
          disabled={atMax}
          hitSlop={6}
          onPress={() => onQuantityChange(max == null ? value + 1 : Math.min(max, value + 1))}
          style={[styles.qtyBtn, atMax && styles.disabled]}
        >
          <Icon name="add" size={16} color={sp.peachInk} />
        </Pressable>
      </View>
    </View>
  )
}

export function AddPill({ added, onPress, label }: { added: boolean; onPress: () => void; label?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={added ? `Remove ${label ?? ""} from bag` : `Add ${label ?? ""} to bag`}
      accessibilityState={{ selected: added }}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [added ? ui.addedPill : ui.addPill, pressed && ui.pressed]}
    >
      <Text style={added ? ui.addedPillText : ui.addPillText}>{added ? "✓ Added" : "Add +"}</Text>
    </Pressable>
  )
}

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
}

export function SalonServiceRow({
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
}: Props) {
  const hasOptions = serviceHasPriceOptions(service)
  const activeOptionId = selectedOptionId || defaultPriceOptionId(service) || ""
  const showQuantity = selected && usesQuantity(service)
  const thumbUrl = service.imageUrl?.trim()
  const description = service.description?.trim()

  function handleAdd() {
    if (hasOptions && activeOptionId) {
      onPriceOptionChange(activeOptionId)
      return
    }
    onToggle()
  }

  return (
    <View style={[styles.row, !isLast && styles.divider]}>
      <View style={styles.top}>
        <Pressable
          style={styles.main}
          onPress={onOpenDetail}
          accessibilityRole="button"
          accessibilityLabel={`${service.name} details`}
        >
          {thumbUrl ? <Image source={{ uri: thumbUrl }} style={styles.thumb} contentFit="cover" /> : null}
          <View style={styles.copy}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={2}>
                {service.name}
              </Text>
              {offerLabel ? (
                <View style={ui.offerBadge}>
                  <Text style={ui.offerBadgeText}>{offerLabel}</Text>
                </View>
              ) : null}
            </View>
            {description ? (
              <Text style={styles.meta} numberOfLines={1}>
                {description}
              </Text>
            ) : null}
            {service.durationMin > 0 ? <Text style={styles.meta}>{formatDuration(service.durationMin)}</Text> : null}
            <View style={styles.priceRow}>
              <Text style={styles.price}>
                {formatServicePriceLabel(service, selected && hasOptions ? activeOptionId : undefined, {
                  finalPrice: selected && hasOptions,
                })}
              </Text>
              {service.compareAtPrice ? (
                <Text style={[styles.meta, ui.strike]}>₹{service.compareAtPrice}</Text>
              ) : null}
            </View>
          </View>
        </Pressable>

        {showQuantity ? (
          <QuantityPill service={service} quantity={quantity} onQuantityChange={onQuantityChange} onRemove={onToggle} />
        ) : (
          <AddPill added={selected} label={service.name} onPress={selected ? onToggle : handleAdd} />
        )}
      </View>

      {hasOptions ? (
        <View style={styles.options}>
          {(service.priceOptions ?? []).map((option) => {
            const active = selected && activeOptionId === option.id
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onPriceOptionChange(option.id)}
                style={[ui.chip, active && ui.chipActive]}
              >
                <Text style={[ui.chipText, active && ui.chipTextActive]}>
                  {option.name} · {formatRupees(option.price)}
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
    paddingVertical: 14,
    gap: 10,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: sp.hairline,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minWidth: 0,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: sp.grey,
  },
  copy: {
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
    marginTop: 2,
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
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  qtyWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyPill: {
    height: 34,
    borderRadius: 999,
    backgroundColor: sp.peachBg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: {
    minWidth: 20,
    textAlign: "center",
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: sp.peachInk,
  },
  disabled: {
    opacity: 0.35,
  },
})
