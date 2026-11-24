import { Image } from "expo-image"
import { Pressable, StyleSheet, View } from "react-native"

import { BottomSheet } from "@/components/ui/BottomSheet"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { SalonPackage, SalonService } from "@/data/types"
import { formatDuration } from "@/lib/booking-display"
import { quantityForService } from "@/lib/pricing-unit"
import {
  defaultPriceOptionId,
  formatRupees,
  formatServicePriceLabel,
  serviceHasPriceOptions,
} from "@/lib/service-pricing"
import { fontFamily } from "@/theme/tokens"

import { QuantityPill, usesQuantity } from "./SalonServiceRow"
import { sp, ui } from "./theme"

function SheetButton({ selected, onPress }: { selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.cta, selected && styles.ctaSecondary, pressed && ui.pressed]}
    >
      <Text style={[styles.ctaText, selected && styles.ctaTextSecondary]}>
        {selected ? "Remove from bag" : "Add to bag"}
      </Text>
    </Pressable>
  )
}

function IncludesList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <>
      <Text style={[ui.sectionLabel, { marginTop: 20 }]}>Includes</Text>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.includeRow}>
          <Icon name="checkmark-circle" size={18} color={sp.ratingInk} />
          <Text style={[styles.body, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </>
  )
}

type ServiceSheetProps = {
  service: SalonService | null
  selected: boolean
  quantities?: Record<string, number>
  priceOptionId?: string | null
  offerLabel?: string
  onClose: () => void
  onToggle: (service: SalonService) => void
  onQuantityChange: (service: SalonService, quantity: number) => void
  onPriceOptionChange: (service: SalonService, optionId: string) => void
}

export function SalonServiceSheet({
  service,
  selected,
  quantities,
  priceOptionId,
  offerLabel,
  onClose,
  onToggle,
  onQuantityChange,
  onPriceOptionChange,
}: ServiceSheetProps) {
  return (
    <BottomSheet visible={service != null} title="Service summary" onClose={onClose}>
      {service ? (
        <View style={styles.wrap}>
          {service.imageUrl?.trim() ? (
            <Image source={{ uri: service.imageUrl }} style={styles.image} contentFit="cover" />
          ) : null}
          <View style={styles.nameRow}>
            <Text style={styles.title}>{service.name}</Text>
            {offerLabel ? (
              <View style={ui.offerBadge}>
                <Text style={ui.offerBadgeText}>{offerLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.meta}>
            {[service.category, service.durationMin > 0 ? formatDuration(service.durationMin) : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {service.description?.trim() ? <Text style={[styles.body, { marginTop: 10 }]}>{service.description}</Text> : null}
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {formatServicePriceLabel(service, selected ? priceOptionId ?? undefined : undefined, {
                finalPrice: selected,
              })}
            </Text>
            {service.compareAtPrice ? <Text style={[styles.meta, ui.strike]}>₹{service.compareAtPrice}</Text> : null}
          </View>
          {serviceHasPriceOptions(service) ? (
            <View style={{ marginTop: 16, gap: 10 }}>
              <Text style={ui.sectionLabel}>Choose a price</Text>
              <View style={styles.options}>
                {service.priceOptions!.map((option) => {
                  const active = selected && (priceOptionId ?? defaultPriceOptionId(service)) === option.id
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => onPriceOptionChange(service, option.id)}
                      style={[ui.chip, active && ui.chipActive]}
                    >
                      <Text style={[ui.chipText, active && ui.chipTextActive]}>
                        {option.name} · {formatRupees(option.price)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ) : null}
          {usesQuantity(service) && selected ? (
            <View style={{ marginTop: 16, alignItems: "flex-start" }}>
              <QuantityPill
                service={service}
                quantity={quantityForService(service, quantities)}
                onQuantityChange={(quantity) => onQuantityChange(service, quantity)}
                onRemove={() => onToggle(service)}
                showLabel
              />
            </View>
          ) : null}
          <IncludesList items={service.includes} />
          <SheetButton
            selected={selected}
            onPress={() => {
              onToggle(service)
              onClose()
            }}
          />
        </View>
      ) : null}
    </BottomSheet>
  )
}

type PackageSheetProps = {
  pkg: SalonPackage | null
  selected: boolean
  onClose: () => void
  onToggle: (pkg: SalonPackage) => void
}

export function SalonPackageSheet({ pkg, selected, onClose, onToggle }: PackageSheetProps) {
  // The package's own photo only; without one the sheet opens straight on the details.
  const image = pkg?.imageUrl?.trim() || ""
  return (
    <BottomSheet visible={pkg != null} title="Package summary" onClose={onClose}>
      {pkg ? (
        <View style={styles.wrap}>
          {image ? <Image source={{ uri: image }} style={styles.image} contentFit="cover" /> : null}
          <Text style={styles.title}>{pkg.name}</Text>
          <Text style={styles.meta}>
            Package
            {pkg.totalDurationMin > 0 ? ` · ${formatDuration(pkg.totalDurationMin)}` : ""}
            {pkg.items.length > 0 ? ` · ${pkg.items.length} services` : ""}
          </Text>
          {pkg.shortDescription ? <Text style={[styles.body, { marginTop: 10 }]}>{pkg.shortDescription}</Text> : null}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatRupees(pkg.packagePrice)}</Text>
            {pkg.showComparePrice !== false && pkg.comparePrice > pkg.packagePrice ? (
              <Text style={[styles.meta, ui.strike]}>{formatRupees(pkg.comparePrice)}</Text>
            ) : null}
          </View>
          <IncludesList
            items={pkg.items.map((item) => `${item.quantity > 1 ? `${item.quantity}× ` : ""}${item.serviceName}`)}
          />
          <SheetButton
            selected={selected}
            onPress={() => {
              onToggle(pkg)
              onClose()
            }}
          />
        </View>
      ) : null}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 8,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.body,
  },
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 20,
    backgroundColor: sp.grey,
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  title: {
    flexShrink: 1,
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
  priceRow: {
    marginTop: 14,
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
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  includeRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
