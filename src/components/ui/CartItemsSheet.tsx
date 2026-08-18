import { Image } from "expo-image"
import { Pressable, StyleSheet, View } from "react-native"

import { Button } from "@/components/ui/Button"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useCart } from "@/context/CartContext"
import { resolveSalonById } from "@/lib/salons-api"
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

  const total = selectedPackage
    ? selectedPackage.packagePrice
    : services.reduce((sum, service) => sum + service.price, 0)

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
    <BottomSheet visible={visible} title="Your cart" onClose={onClose}>
      {isEmpty ? (
        <View style={styles.empty}>
          <Text muted>Your cart is empty. Add services from a salon to book.</Text>
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

          {services.map((service) => (
            <View key={service.id} style={styles.itemRow}>
              <Image
                source={{ uri: service.imageUrl }}
                style={styles.itemThumb}
                contentFit="cover"
              />
              <View style={styles.itemCopy}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {service.name}
                </Text>
                <Text variant="caption" muted>
                  {service.category} · {service.durationMin} min
                </Text>
                <Text variant="bodyStrong">₹{service.price}</Text>
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
          ))}

          <View style={styles.totalRow}>
            <Text variant="bodyStrong">Total</Text>
            <Text variant="heading">₹{total}</Text>
          </View>

          <Button
            label="Clear cart"
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
    alignItems: "center",
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
