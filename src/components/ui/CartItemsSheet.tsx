import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { bk, BookingCard, Hairline, ReceiptRow, ReceiptTotal } from "@/components/book/BookingUi"
import { pastelForName, ThumbOrFallback } from "@/components/home/PhotoFallback"
import { GradientFill } from "@/components/home/GradientFill"
import {
  ServiceQuantityStepper,
  serviceUsesQuantity,
} from "@/components/salon/ServiceQuantityStepper"
import { ui } from "@/components/salon-page/theme"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useCart } from "@/context/CartContext"
import { isArtistCartId } from "@/lib/artist-cart"
import { formatDuration } from "@/lib/booking-display"
import { serviceGenderLabel } from "@/lib/gender-audience"
import { quantityForService } from "@/lib/pricing-unit"
import { salonProfileImageUrl } from "@/data/mocks/salons"
import { resolveSalonById } from "@/lib/salons-api"
import {
  cartServicesSubtotal,
  formatRupees,
  formatServicePriceLabel,
  resolveServiceOptionPrice,
  serviceCartCaption,
  serviceLineAmount,
} from "@/lib/service-pricing"
import { fontFamily } from "@/theme/tokens"

type Props = {
  visible: boolean
  salonId: string | null
  onClose: () => void
  onContinue: (salonId: string) => void
}

type Line = {
  key: string
  name: string
  caption?: string | null
  tag?: string | null
  price: string
  oldPrice?: string | null
  onRemove: () => void
  stepper?: ReactNode
}

function serviceWord(count: number) {
  return count === 1 ? "service" : "services"
}

function SheetHeader({
  name,
  imageUrl,
  caption,
  onClose,
}: {
  name: string
  imageUrl?: string | null
  caption: string
  onClose: () => void
}) {
  return (
    <View style={styles.header}>
      <ThumbOrFallback uri={imageUrl} name={name} style={styles.squircle} />
      <View style={styles.headerCopy}>
        <Text style={styles.headerName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.headerCaption} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={10}
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && ui.pressed]}
      >
        <Icon name="close" size={20} color={bk.text} />
      </Pressable>
    </View>
  )
}

function BagLine({ line }: { line: Line }) {
  return (
    <View style={styles.line}>
      <View style={styles.lineTop}>
        <View style={styles.lineCopy}>
          <Text style={styles.lineName} numberOfLines={2}>
            {line.name}
          </Text>
          {line.caption || line.tag ? (
            <View style={styles.captionRow}>
              {line.caption ? (
                <Text style={styles.lineCaption} numberOfLines={2}>
                  {line.caption}
                </Text>
              ) : null}
              {line.tag ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{line.tag}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={styles.lineRight}>
          <Text style={styles.linePrice}>{line.price}</Text>
          {line.oldPrice ? (
            <Text style={[styles.lineOld, ui.strike]}>{line.oldPrice}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.lineActions}>
        {line.stepper ?? <View />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${line.name}`}
          hitSlop={10}
          onPress={line.onRemove}
          style={({ pressed }) => pressed && ui.pressed}
        >
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      </View>
    </View>
  )
}

function OutlinePill({ label, icon, onPress }: { label: string; icon: "add" | "search-outline"; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.outline, pressed && ui.pressed]}
    >
      <Icon name={icon} size={16} color={bk.text} />
      <Text style={styles.outlineText}>{label}</Text>
    </Pressable>
  )
}

export function CartItemsSheet({ visible, salonId, onClose, onContinue }: Props) {
  const cart = useCart()
  const salonCart = salonId ? cart.getCart(salonId) : undefined
  const isArtist = Boolean(
    salonId && (salonCart?.kind === "artist" || isArtistCartId(salonId)),
  )
  const salon = salonId && !isArtist ? resolveSalonById(salonId) : undefined

  function removeService(serviceId: string) {
    if (!salonId) return
    cart.toggleService(salonId, serviceId)
  }

  function removePackage() {
    if (!salonId) return
    cart.setPackage(salonId, null)
  }

  const lines: Line[] = []
  let total = 0
  let compareTotal = 0
  let durationMin = 0
  let providerName = ""
  let providerImage: string | null | undefined = null

  if (isArtist && salonCart) {
    providerName = salonCart.providerName?.trim() || "Solo artist"
    providerImage = salonCart.providerImageUrl
    for (const id of salonCart.serviceIds) {
      const line = salonCart.serviceLines?.[id]
      const price = Number(line?.price) || 0
      total += price
      compareTotal += price
      durationMin += line?.durationMin ?? 0
      lines.push({
        key: id,
        name: line?.name || "Service",
        caption: line?.durationMin ? formatDuration(line.durationMin) : null,
        price: formatRupees(price),
        onRemove: () => removeService(id),
      })
    }
  } else if (salon && salonCart) {
    providerName = salon.name
    providerImage = salonProfileImageUrl(salon)
    const selectedPackage = salonCart.packageId
      ? salon.packages.find((item) => item.id === salonCart.packageId)
      : undefined
    const services = salon.services.filter((service) => salonCart.serviceIds.includes(service.id))

    // Same maths as before: the total is the cart subtotal helper, untouched.
    total = cartServicesSubtotal(
      salon.services,
      salonCart.serviceIds,
      selectedPackage ?? null,
      salonCart.quantities,
      salonCart.priceOptionIds,
    )

    if (selectedPackage) {
      const showCompare =
        selectedPackage.showComparePrice !== false &&
        selectedPackage.comparePrice > selectedPackage.packagePrice
      compareTotal += showCompare ? selectedPackage.comparePrice : selectedPackage.packagePrice
      durationMin += selectedPackage.totalDurationMin
      lines.push({
        key: `package-${selectedPackage.id}`,
        name: selectedPackage.name,
        caption:
          selectedPackage.totalDurationMin > 0
            ? formatDuration(selectedPackage.totalDurationMin)
            : null,
        tag: "Package",
        price: formatRupees(selectedPackage.packagePrice),
        oldPrice: showCompare ? formatRupees(selectedPackage.comparePrice) : null,
        onRemove: removePackage,
      })
    }

    const packageServiceIds = new Set(
      (selectedPackage?.items ?? []).map((item) => item.serviceId).filter(Boolean),
    )

    for (const service of services) {
      const optionId = salonCart.priceOptionIds[service.id] ?? null
      const quantity = quantityForService(service, salonCart.quantities)
      const linePrice = serviceLineAmount(service, salonCart.quantities, optionId)
      const showQuantity = serviceUsesQuantity(service)
      const unitPrice = resolveServiceOptionPrice(service, optionId)
      const compareUnit =
        !optionId && service.compareAtPrice && service.compareAtPrice > unitPrice
          ? service.compareAtPrice
          : null
      const inPackage = packageServiceIds.has(service.id)
      if (!inPackage) compareTotal += compareUnit ? compareUnit * quantity : linePrice
      durationMin += service.durationMin * quantity
      lines.push({
        key: service.id,
        name: service.name,
        caption: serviceCartCaption(service, salonCart.quantities, optionId),
        tag: serviceGenderLabel(service.genderAudience),
        price: showQuantity
          ? formatRupees(linePrice)
          : formatServicePriceLabel(service, optionId, { finalPrice: true }),
        oldPrice: compareUnit ? formatRupees(compareUnit * quantity) : null,
        onRemove: () => removeService(service.id),
        stepper: showQuantity ? (
          <ServiceQuantityStepper
            service={service}
            quantity={quantity}
            onQuantityChange={(next) =>
              salonId
                ? cart.setServiceQuantity(salonId, service.id, next, service.pricingUnit)
                : undefined
            }
            onRemove={() => removeService(service.id)}
          />
        ) : null,
      })
    }
  }

  const isEmpty = lines.length === 0
  const savings = Math.max(0, compareTotal - total)
  const continueId = isArtist ? salonId : salon?.id ?? null

  function clearBag() {
    if (salonId) cart.clearSalon(salonId)
    onClose()
  }

  function continueBooking() {
    if (!continueId) return
    onClose()
    onContinue(continueId)
  }

  const headerCaption = [
    `${lines.length} ${serviceWord(lines.length)}`,
    durationMin > 0 ? formatDuration(durationMin) : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const footer = isEmpty ? undefined : (
    <View style={styles.footer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clear bag"
        hitSlop={8}
        onPress={clearBag}
        style={({ pressed }) => [styles.clear, pressed && ui.pressed]}
      >
        <Text style={styles.clearText}>Clear</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Continue booking, ${formatRupees(total)}`}
        onPress={continueBooking}
        style={({ pressed }) => [styles.cta, pressed && ui.pressed]}
      >
        <Text style={styles.ctaText} numberOfLines={1}>
          Continue · {formatRupees(total)}
        </Text>
      </Pressable>
    </View>
  )

  return (
    <BottomSheet
      visible={visible}
      title="Your bag"
      onClose={onClose}
      compact
      footer={footer}
      renderHeader={
        isEmpty
          ? undefined
          : (close) => (
              <SheetHeader
                name={providerName}
                imageUrl={providerImage}
                caption={headerCaption}
                onClose={close}
              />
            )
      }
    >
      {isEmpty ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <GradientFill colors={pastelForName("bag").gradient} angle={150} />
            <Icon name="bag-handle-outline" size={28} color={pastelForName("bag").ink} />
          </View>
          <Text style={styles.emptyTitle}>Your bag is empty</Text>
          <Text style={styles.emptyBody}>
            Add services from a salon or solo artist to start booking.
          </Text>
          <OutlinePill label="Browse services" icon="search-outline" onPress={onClose} />
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={ui.sectionLabel}>Your bag</Text>
          <BookingCard style={styles.card}>
            {lines.map((line, index) => (
              <View key={line.key}>
                {index > 0 ? <Hairline /> : null}
                <BagLine line={line} />
              </View>
            ))}
          </BookingCard>

          <OutlinePill label="Add more services" icon="add" onPress={onClose} />

          <BookingCard>
            {savings > 0 ? (
              <>
                <ReceiptRow label="Subtotal" value={formatRupees(compareTotal)} />
                <ReceiptRow label="You save" value={`−${formatRupees(savings)}`} tone="success" />
              </>
            ) : null}
            <ReceiptTotal label="Total" value={formatRupees(total)} />
          </BookingCard>
        </View>
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  squircle: { width: 48, height: 48, borderRadius: 16 },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  headerName: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 23, color: bk.text },
  headerCaption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: bk.secondary },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: bk.grey,
    alignItems: "center",
    justifyContent: "center",
  },

  body: { gap: 14, paddingBottom: 8 },
  card: { paddingVertical: 4, gap: 0 },
  line: { paddingVertical: 12, gap: 8 },
  lineTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  lineCopy: { flex: 1, minWidth: 0, gap: 3 },
  lineName: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: bk.text },
  captionRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  lineCaption: { flexShrink: 1, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: bk.secondary },
  tag: { backgroundColor: bk.grey, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 14, color: bk.secondary },
  lineRight: { alignItems: "flex-end", gap: 1 },
  linePrice: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20, color: bk.text },
  lineOld: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: bk.muted },
  lineActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  remove: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: bk.secondary,
    textDecorationLine: "underline",
  },

  outline: {
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: bk.border,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    alignSelf: "stretch",
  },
  outlineText: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 19, color: bk.text },

  footer: { flexDirection: "row", alignItems: "center", gap: 16 },
  clear: { paddingVertical: 8, paddingHorizontal: 4 },
  clearText: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: bk.secondary },
  cta: {
    flex: 1,
    height: 52,
    borderRadius: 999,
    backgroundColor: bk.text,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  ctaText: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 21, color: "#ffffff" },

  empty: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 12, gap: 8 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 23, color: bk.text },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: bk.secondary,
    textAlign: "center",
    marginBottom: 10,
  },
})
