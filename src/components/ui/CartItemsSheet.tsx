import { Image } from "expo-image"
import { Pressable, StyleSheet, View } from "react-native"

import {
  ServiceQuantityStepper,
  serviceUsesQuantity,
} from "@/components/salon/ServiceQuantityStepper"
import { Button } from "@/components/ui/Button"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useCart } from "@/context/CartContext"
import { serviceGenderLabel } from "@/lib/gender-audience"
import { quantityForService } from "@/lib/pricing-unit"
import { resolveSalonById } from "@/lib/salons-api"
import {
  cartServicesSubtotal,
  formatRupees,
  formatServicePriceLabel,
  serviceCartCaption,
  serviceLineAmount,
} from "@/lib/service-pricing"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  visible: boolean
  salonId: string | null
  onClose: () => void
  onContinue: (salonId: string) => void
}

export function CartItemsSheet({ visible, salonId, onClose, onContinue }: Props) {
  const cart = useCart()
  const salonCart = salonId ? cart.getCart(salonId) : undefined
  const salon = salonId ? resolveSalonById(salonId) : undefined

  const services =
    salon && salonCart
      ? salon.services.filter((service) => salonCart.serviceIds.includes(service.id))
      : []
  const selectedPackage =
    salon && salonCart?.packageId
      ? salon.packages.find((item) => item.id === salonCart.packageId)
      : undefined

  const total = salon
    ? cartServicesSubtotal(
        salon.services,
        salonCart?.serviceIds ?? [],
        selectedPackage ?? null,
        salonCart?.quantities,
        salonCart?.priceOptionIds,
      )
    : 0

  const isEmpty = !salon || !salonCart || (services.length === 0 && !selectedPackage)

  function removeService(serviceId: string) {
    if (!salonId) return
    cart.toggleService(salonId, serviceId)
  }

  function removePackage() {
    if (!salonId) return
    cart.setPackage(salonId, null)
  }

  return (
    <BottomSheet visible={visible} title="Your bag" onClose={onClose}>
      {isEmpty ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="bag-handle-outline" size={28} color={colors.textSubtle} />
          </View>
          <Text variant="bodyStrong" style={styles.emptyTitle}>
            Your bag is empty
          </Text>
          <Text muted style={styles.emptyBody}>
            Add services from a salon to start booking.
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.salonRow}>
            <Image
              source={{ uri: salon.imageUrl }}
              style={styles.salonThumb}
              contentFit="cover"
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="caption" muted>
                Booking at
              </Text>
              <Text variant="bodyStrong" numberOfLines={1}>
                {salon.name}
              </Text>
              <Text variant="caption" muted numberOfLines={1}>
                {salon.area}, {salon.city}
              </Text>
            </View>
          </View>

          {selectedPackage ? (
            <View style={styles.itemRow}>
              <Image
                source={{ uri: selectedPackage.imageUrl }}
                style={styles.itemThumb}
                contentFit="cover"
              />
              <View style={styles.itemCopy}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {selectedPackage.name}
                </Text>
                <Text variant="caption" muted>
                  Package
                  {selectedPackage.totalDurationMin > 0
                    ? ` · ${selectedPackage.totalDurationMin} min`
                    : ""}
                </Text>
                <Text variant="bodyStrong">₹{selectedPackage.packagePrice}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${selectedPackage.name}`}
                hitSlop={8}
                onPress={removePackage}
                style={styles.removeBtn}
              >
                <Icon name="close" size={16} color={colors.textSubtle} />
              </Pressable>
            </View>
          ) : null}

          {services.map((service) => {
            const optionId = salonCart?.priceOptionIds[service.id] ?? null
            const quantity = quantityForService(service, salonCart?.quantities)
            const genderLabel = serviceGenderLabel(service.genderAudience)
            const linePrice = serviceLineAmount(service, salonCart?.quantities, optionId)
            const showQuantity = serviceUsesQuantity(service)
            return (
              <View key={service.id} style={styles.itemRow}>
                <Image
                  source={{ uri: service.imageUrl }}
                  style={styles.itemThumb}
                  contentFit="cover"
                />
                <View style={styles.itemCopy}>
                  <View style={styles.nameRow}>
                    <Text variant="bodyStrong" numberOfLines={2} style={{ flexShrink: 1 }}>
                      {service.name}
                    </Text>
                    {genderLabel ? (
                      <View style={styles.genderBadge}>
                        <Text variant="caption" muted style={styles.genderBadgeLabel}>
                          {genderLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="caption" muted>
                    {serviceCartCaption(service, salonCart?.quantities, optionId)}
                  </Text>
                  <Text variant="bodyStrong">
                    {showQuantity
                      ? formatRupees(linePrice)
                      : formatServicePriceLabel(service, optionId, { finalPrice: true })}
                  </Text>
                  {showQuantity ? (
                    <View style={{ marginTop: 6 }}>
                      <ServiceQuantityStepper
                        service={service}
                        quantity={quantity}
                        onQuantityChange={(next) =>
                          salonId
                            ? cart.setServiceQuantity(
                                salonId,
                                service.id,
                                next,
                                service.pricingUnit,
                              )
                            : undefined
                        }
                        onRemove={() => removeService(service.id)}
                      />
                    </View>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${service.name}`}
                  hitSlop={8}
                  onPress={() => removeService(service.id)}
                  style={styles.removeBtn}
                >
                  <Icon name="close" size={16} color={colors.textSubtle} />
                </Pressable>
              </View>
            )
          })}

          <View style={styles.totalRow}>
            <Text variant="bodyStrong">Total</Text>
            <Text variant="heading">{formatRupees(total)}</Text>
          </View>

          <Button
            label="Clear bag"
            variant="secondary"
            onPress={() => {
              if (salonId) cart.clearSalon(salonId)
              onClose()
            }}
          />
          <Button
            label="Continue booking"
            style={{ marginTop: spacing.sm }}
            onPress={() => {
              onClose()
              onContinue(salon.id)
            }}
          />
        </View>
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptyBody: {
    textAlign: "center",
  },
  body: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  salonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  salonThumb: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemThumb: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  itemCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  genderBadge: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
  },
  genderBadgeLabel: {
    fontSize: 10,
    lineHeight: 14,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  totalRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
})
