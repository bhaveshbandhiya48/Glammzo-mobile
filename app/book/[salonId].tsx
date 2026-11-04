import { Image } from "expo-image"
import { useLocalSearchParams, useRouter, type Href } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native"

import { BookingConfirmSheet } from "@/components/book/BookingConfirmSheet"
import { BookingDateSheet } from "@/components/book/BookingDateSheet"
import { BookingSelectTrigger } from "@/components/book/BookingSelectTrigger"
import { WaitlistPrompt } from "@/components/book/WaitlistPrompt"
import { BookingTimeSheet } from "@/components/book/BookingTimeSheet"
import {
  PromoSuccessCelebration,
  type PromoCelebrationPayload,
} from "@/components/book/PromoSuccessCelebration"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
import { Screen } from "@/components/ui/Screen"
import { SalonDetailSkeleton } from "@/components/ui/Skeleton"
import { StickyCta } from "@/components/ui/StickyCta"
import { Text } from "@/components/ui/Text"
import { useCart } from "@/context/CartContext"
import type { Salon } from "@/data/types"
import { ApiError } from "@/lib/api"
import { fetchMe } from "@/lib/auth-api"
import {
  computeSalonAdvance,
  fetchAvailability,
  salonAdvancePolicyLines,
  type SalonAdvanceConfig,
  type AvailabilityDay,
  type AvailabilitySlot,
  type AvailabilityStaff,
} from "@/lib/availability-api"
import { createBooking } from "@/lib/bookings-api"
import {
  canApplyLoyalty,
  EMPTY_LOYALTY_SUMMARY,
  LOYALTY_DISCOUNT_CAP_RUPEES,
  LOYALTY_VISITS_PER_FREE,
  type LoyaltySummary,
} from "@/lib/loyalty"
import { loadProfilePreferApi, syncProfileEmailFromBooking } from "@/lib/profile-api"
import {
  validatePromoCode,
  type AppliedOfferDiscount,
  type PromoCashbackClaim,
} from "@/lib/promo-api"
import { getSalonByIdLive } from "@/lib/salons-api"
import {
  cartServicesSubtotal,
  formatRupees,
  serviceCartCaption,
  serviceLineAmount,
  withDefaultPriceOptionIds,
} from "@/lib/service-pricing"
import { getAccessToken } from "@/lib/session"
import {
  isValidEmail,
  normalizeMobileDigits,
  patchConsumerProfileCache,
} from "@/lib/user"
import { fetchLoyalty, fetchWallet } from "@/lib/wallet-api"
import { colors, radii, spacing } from "@/theme/tokens"

function formatDayChip(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

const NO_STAFF_MESSAGE =
  "This category has no staff assigned, so date and time can’t be selected. Choose another service or contact the salon."

export default function BookingScreen() {
  const router = useRouter()
  // `staffId` comes from Book again: keep the same stylist when they still do these services.
  const { salonId, staffId: staffParam } = useLocalSearchParams<{ salonId: string; staffId?: string }>()
  const [salon, setSalon] = useState<Salon | undefined>()
  const [salonLoading, setSalonLoading] = useState(true)
  const cart = useCart()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [promoInput, setPromoInput] = useState("")
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedOfferDiscount | null>(
    null,
  )
  const [cashbackClaim, setCashbackClaim] = useState<PromoCashbackClaim | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoApplying, setPromoApplying] = useState(false)
  const [promoCelebration, setPromoCelebration] =
    useState<PromoCelebrationPayload | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dateOverride, setDateOverride] = useState<string | null>(null)
  const [availabilityDays, setAvailabilityDays] = useState<AvailabilityDay[]>([])
  const [advanceConfig, setAdvanceConfig] = useState<SalonAdvanceConfig | null>(null)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [bookableStaff, setBookableStaff] = useState<AvailabilityStaff[]>([])
  const [slotValue, setSlotValue] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [slotsMessage, setSlotsMessage] = useState<string | null>(null)
  const [dateSheetOpen, setDateSheetOpen] = useState(false)
  const [timeSheetOpen, setTimeSheetOpen] = useState(false)
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false)
  const [staffId, setStaffId] = useState<string | null>(staffParam || null)
  const [useWallet, setUseWallet] = useState(false)
  const [useLoyalty, setUseLoyalty] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(EMPTY_LOYALTY_SUMMARY)
  const [walletBalance, setWalletBalance] = useState(0)
  const [phoneMissing, setPhoneMissing] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height)
    })
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0)
    })
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  useEffect(() => {
    let active = true
    getAccessToken().then(async (token) => {
      if (!active) return
      if (!token) {
        router.replace({
          pathname: "/login",
          params: { next: `/book/${salonId}` },
        })
        return
      }

      const [loyaltyResult, walletResult, profileResult] = await Promise.allSettled([
        fetchLoyalty(),
        fetchWallet(),
        loadProfilePreferApi(),
      ])
      if (!active) return

      if (loyaltyResult.status === "fulfilled") {
        setLoyalty(loyaltyResult.value)
      }

      if (walletResult.status === "fulfilled") {
        const walletNext = walletResult.value
        const balance = walletNext.wallet?.balanceRupees ?? 0
        setWalletBalance(balance)
        if (balance <= 0) setUseWallet(false)
      }

      let nextName = ""
      let nextEmail = ""
      let nextPhone = ""
      if (profileResult.status === "fulfilled") {
        nextName = profileResult.value.name.trim()
        nextEmail = profileResult.value.email.trim()
        nextPhone = normalizeMobileDigits(profileResult.value.phone)
      }

      if (!nextPhone || nextPhone.length < 10) {
        try {
          const me = await fetchMe()
          const mePhone = normalizeMobileDigits(me.user?.phone ?? "")
          if (mePhone.length >= 10) {
            nextPhone = mePhone
            await patchConsumerProfileCache({
              phone: mePhone,
              name: me.user?.name?.trim() || undefined,
              email: me.user?.email?.trim() || undefined,
            })
          }
          if (!nextName && me.user?.name?.trim()) {
            nextName = me.user.name.trim()
          }
          if (!nextEmail && me.user?.email?.trim()) {
            nextEmail = me.user.email.trim()
          }
        } catch {
          // keep whatever we have from profile cache
        }
      }

      if (!active) return
      if (nextName) setName(nextName)
      if (nextEmail) setEmail(nextEmail)
      if (nextPhone.length >= 10) {
        setPhone(nextPhone)
        setPhoneMissing(false)
      } else {
        setPhoneMissing(true)
      }
    })
    return () => {
      active = false
    }
  }, [router, salonId])

  useEffect(() => {
    let active = true
    if (typeof salonId !== "string") {
      setSalon(undefined)
      setSalonLoading(false)
      return
    }
    setSalonLoading(true)
    getSalonByIdLive(salonId).then((next) => {
      if (!active) return
      setSalon(next)
      setSalonLoading(false)
    })
    return () => {
      active = false
    }
  }, [salonId])

  const salonCart = salon ? cart.getCart(salon.id) : undefined

  const selectedServices = useMemo(() => {
    if (!salon || !salonCart) return []
    return salon.services.filter((service) => salonCart.serviceIds.includes(service.id))
  }, [salon, salonCart])

  const selectedPackage = useMemo(() => {
    if (!salon || !salonCart?.packageId) return undefined
    return salon.packages.find((item) => item.id === salonCart.packageId)
  }, [salon, salonCart])

  const serviceIdsForAvailability = useMemo(() => {
    if (selectedPackage) {
      return selectedPackage.items.map((item) => item.serviceId)
    }
    return selectedServices.map((service) => service.id)
  }, [selectedPackage, selectedServices])

  useEffect(() => {
    setDateOverride(null)
  }, [serviceIdsForAvailability.join(","), selectedPackage?.id, staffId])

  useEffect(() => {
    let active = true
    if (!salon || serviceIdsForAvailability.length === 0) {
      setAvailabilityDays([])
      setSlots([])
      setBookableStaff([])
      setSlotValue(null)
      setSelectedDate(null)
      setSlotsMessage(null)
      setSlotsLoading(false)
      return
    }

    setSlotsLoading(true)
    setSlotsMessage(null)
    fetchAvailability({
      salonId: salon.id,
      date: dateOverride ?? undefined,
      serviceIds: serviceIdsForAvailability,
      packageId: selectedPackage?.id,
      staffId,
    })
      .then((result) => {
        if (!active) return
        setAvailabilityDays(result.days)
        setAdvanceConfig(result.advance)
        setSelectedDate(result.date)
        setSlots(result.slots)

        if (selectedPackage) {
          setBookableStaff([])
        } else {
          // Trust API eligibility — never fall back to the full salon team.
          setBookableStaff(result.staff)
        }

        const noEligibleStaff = !selectedPackage && result.staff.length === 0
        setSlotsMessage(
          noEligibleStaff
            ? result.closedMessage?.trim() || NO_STAFF_MESSAGE
            : result.closed
              ? result.closedMessage
              : null,
        )
        // Match web: don't auto-pick a time — user selects from the dropdown.
        setSlotValue((prev) => {
          if (prev && result.slots.some((slot) => slot.value === prev)) return prev
          return null
        })
      })
      .catch((err) => {
        if (!active) return
        setSlots([])
        setSlotValue(null)
        setBookableStaff([])
        setSlotsMessage(
          err instanceof ApiError ? err.message : "Could not load available times.",
        )
      })
      .finally(() => {
        if (active) setSlotsLoading(false)
      })

    return () => {
      active = false
    }
  }, [
    salon,
    serviceIdsForAvailability,
    selectedPackage?.id,
    staffId,
    dateOverride,
  ])

  useEffect(() => {
    if (bookableStaff.length === 1) {
      const onlyId = bookableStaff[0]!.id
      if (staffId !== onlyId) setStaffId(onlyId)
      return
    }
    if (staffId && bookableStaff.length > 0 && !bookableStaff.some((member) => member.id === staffId)) {
      setStaffId(null)
    }
  }, [bookableStaff, staffId])

  const selectedSlotLabel =
    slots.find((slot) => slot.value === slotValue)?.label ?? slotValue ?? "—"

  const subtotal = salon
    ? cartServicesSubtotal(
        salon.services,
        salonCart?.serviceIds ?? [],
        selectedPackage ?? null,
        salonCart?.quantities,
        salonCart?.priceOptionIds,
      )
    : 0

  const loyaltyAvailable = canApplyLoyalty(loyalty)
  const afterPromo = appliedDiscount?.finalTotal ?? subtotal
  const promoDiscount = appliedDiscount?.discountAmount ?? 0
  const appliedPromoCode = appliedDiscount?.code ?? cashbackClaim?.code ?? null
  const loyaltyCredit =
    useLoyalty && loyaltyAvailable && !selectedPackage
      ? Math.min(LOYALTY_DISCOUNT_CAP_RUPEES, Math.max(afterPromo, 0))
      : 0
  const taxableAmount = Math.max(0, afterPromo - loyaltyCredit)
  const salonTax =
    salon?.tax &&
    salon.tax.enabled &&
    salon.tax.gstNumber.trim() &&
    salon.tax.ratePercent > 0
      ? salon.tax
      : null
  const gstAmount = salonTax
    ? Math.round(taxableAmount * (salonTax.ratePercent / 100) * 100) / 100
    : 0
  const amountBeforeWallet = Math.round((taxableAmount + gstAmount) * 100) / 100
  const walletCredit = useWallet
    ? Math.min(Math.max(0, Math.round(walletBalance)), amountBeforeWallet)
    : 0
  const total = Math.max(amountBeforeWallet - walletCredit, 0)
  // Pro salons asking for an advance: part of the bill is paid in the app to confirm.
  const advanceDue = computeSalonAdvance(advanceConfig, total)

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase()
    if (!code) {
      setPromoError("Enter a promo code")
      return
    }
    if (!salon || serviceIdsForAvailability.length === 0) {
      setPromoError("Add services to your bag before applying a promo code.")
      return
    }

    setPromoApplying(true)
    setPromoError(null)
    try {
      const servicePriceOptionIds = selectedPackage
        ? withDefaultPriceOptionIds(
            salon.services,
            serviceIdsForAvailability,
            salonCart?.priceOptionIds,
          )
        : salonCart?.priceOptionIds
      const result = await validatePromoCode({
        salonId: salon.id,
        code,
        serviceIds: serviceIdsForAvailability,
        packageId: selectedPackage?.id,
        serviceQuantities: salonCart?.quantities,
        servicePriceOptionIds,
      })

      if (result.kind === "discount") {
        setAppliedDiscount(result.discount)
        setCashbackClaim(null)
        setPromoInput(result.discount.code)
        setPromoCelebration({ kind: "discount", discount: result.discount })
        return
      }

      setAppliedDiscount(null)
      setCashbackClaim(result.cashback)
      setPromoInput(result.cashback.code)
      setPromoCelebration({ kind: "cashback", cashback: result.cashback })
    } catch (err) {
      setAppliedDiscount(null)
      setCashbackClaim(null)
      setPromoError(err instanceof ApiError ? err.message : "Could not apply promo code.")
    } finally {
      setPromoApplying(false)
    }
  }

  function clearPromo() {
    setAppliedDiscount(null)
    setCashbackClaim(null)
    setPromoInput("")
    setPromoError(null)
  }

  // Keep applied promo in sync when cart services/package change (match web).
  useEffect(() => {
    if (!salon || (!appliedDiscount && !cashbackClaim)) return
    const code = appliedDiscount?.code ?? cashbackClaim?.code
    if (!code || serviceIdsForAvailability.length === 0) {
      clearPromo()
      return
    }

    let active = true
    const servicePriceOptionIds = selectedPackage
      ? withDefaultPriceOptionIds(
          salon.services,
          serviceIdsForAvailability,
          salonCart?.priceOptionIds,
        )
      : salonCart?.priceOptionIds
    void validatePromoCode({
      salonId: salon.id,
      code,
      serviceIds: serviceIdsForAvailability,
      packageId: selectedPackage?.id,
      serviceQuantities: salonCart?.quantities,
      servicePriceOptionIds,
    })
      .then((result) => {
        if (!active) return
        if (result.kind === "discount") {
          setAppliedDiscount(result.discount)
          setCashbackClaim(null)
          setPromoError(null)
          return
        }
        setAppliedDiscount(null)
        setCashbackClaim(result.cashback)
        setPromoError(null)
      })
      .catch((err) => {
        if (!active) return
        setAppliedDiscount(null)
        setCashbackClaim(null)
        setPromoError(
          err instanceof ApiError
            ? err.message
            : "This code is no longer valid for your bag.",
        )
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revalidate only when cart shape changes
  }, [
    salon?.id,
    serviceIdsForAvailability.join("|"),
    selectedPackage?.id,
    JSON.stringify(salonCart?.quantities ?? {}),
    JSON.stringify(salonCart?.priceOptionIds ?? {}),
  ])

  if (salonLoading) {
    return <SalonDetailSkeleton />
  }

  if (!salon) {
    return (
      <Screen>
        <Text variant="heading">Salon unavailable</Text>
        <Button
          label="Browse salons"
          style={{ marginTop: spacing.xl }}
          onPress={() => router.replace("/(tabs)/explore")}
        />
      </Screen>
    )
  }

  const hasSelection = Boolean(selectedPackage) || selectedServices.length > 0
  const noStaffForServices =
    hasSelection && !selectedPackage && !slotsLoading && bookableStaff.length === 0
  const selectedStaffName =
    staffId != null
      ? bookableStaff.find((member) => member.id === staffId)?.name ?? null
      : bookableStaff.length > 0
        ? "Any available"
        : null
  const dateOptions = availabilityDays.map((day) => ({
    date: day.date,
    label: formatDayChip(day.date),
    disabled: day.availableCount === 0,
  }))

  const confirmServiceLines = selectedPackage
    ? [
        {
          title: selectedPackage.name,
          subtitle: `Package · ${selectedPackage.totalDurationMin} min`,
          priceLabel: `₹${selectedPackage.packagePrice}`,
        },
      ]
    : selectedServices.map((service) => {
        const optionId = salonCart?.priceOptionIds[service.id] ?? null
        return {
          title: service.name,
          subtitle: serviceCartCaption(service, salonCart?.quantities, optionId),
          priceLabel: formatRupees(
            serviceLineAmount(service, salonCart?.quantities, optionId),
          ),
        }
      })

  const confirmPriceLines = [
    { label: "Subtotal", value: `${formatRupees(subtotal)}` },
    ...(promoDiscount > 0 && appliedDiscount
      ? [
          {
            label: `Promo (${appliedDiscount.code})`,
            value: `−${formatRupees(promoDiscount)}`,
            success: true,
          },
        ]
      : []),
    ...(cashbackClaim
      ? [
          {
            label: `Cashback (${cashbackClaim.code})`,
            value: `+₹${cashbackClaim.cashbackRupees} later`,
            muted: true,
          },
        ]
      : []),
    ...(loyaltyCredit > 0
      ? [{ label: "Loyalty", value: `−₹${loyaltyCredit}`, success: true }]
      : []),
    ...(gstAmount > 0 && salonTax
      ? [
          {
            label: `GST (${
              Number.isInteger(salonTax.ratePercent)
                ? salonTax.ratePercent
                : salonTax.ratePercent.toFixed(2)
            }%)`,
            value: `${formatRupees(gstAmount)}`,
          },
        ]
      : []),
    ...(walletCredit > 0
      ? [{ label: "Wallet", value: `−₹${walletCredit}`, success: true }]
      : []),
  ]

  async function submitBooking() {
    if (submitting || !salon || !selectedDate || !slotValue) return
    const customerPhone = normalizeMobileDigits(phone)
    if (customerPhone.length < 10 || !isValidEmail(email)) {
      setSubmitError(
        customerPhone.length < 10
          ? "Verified mobile is missing. Please sign in again."
          : "Enter a valid email for your invoice.",
      )
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const bookingServiceIds = selectedPackage
        ? selectedPackage.items.map((item) => item.serviceId)
        : selectedServices.map((service) => service.id)
      // Package cart never collects per-item option chips; send catalogue defaults so
      // the API does not reject with "choose a price option" (e.g. hair type).
      const servicePriceOptionIds = selectedPackage
        ? withDefaultPriceOptionIds(
            salon.services,
            bookingServiceIds,
            salonCart?.priceOptionIds,
          )
        : salonCart?.priceOptionIds
      const result = await createBooking({
        salonId: salon.id,
        serviceIds: bookingServiceIds,
        date: selectedDate,
        time: slotValue,
        notes: notes.trim() || undefined,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone,
        preferredStaffId: selectedPackage ? undefined : staffId || undefined,
        packageId: selectedPackage?.id,
        promoCode: appliedPromoCode || undefined,
        useWallet: useWallet && walletBalance > 0,
        useFreeService: useLoyalty && loyaltyAvailable,
        marketingOptIn,
        serviceQuantities: salonCart?.quantities,
        servicePriceOptionIds,
      })
      // Keep profile in sync when the guest adds/updates email at checkout.
      void syncProfileEmailFromBooking(email)
      cart.clearSalon(salon.id)
      setConfirmSheetOpen(false)
      const confirmation = {
        salonId: salon.id,
        bookingId: result.booking.id,
        total: String(result.booking.price ?? total),
        slot: result.booking.time || selectedSlotLabel,
        name: name.trim(),
        date: result.booking.date || selectedDate,
      }
      // The salon asks for an advance: pay it in the app, then land on the confirmation.
      if (result.booking.advanceToken) {
        router.replace({
          pathname: "/pay/advance/[token]",
          params: {
            token: result.booking.advanceToken,
            next: JSON.stringify({ ...confirmation, payToken: result.booking.advanceToken }),
          },
        } as Href)
        return
      }
      router.replace({
        pathname: "/book/confirmation",
        params: {
          salonId: salon.id,
          bookingId: result.booking.id,
          total: String(result.booking.price ?? total),
          slot: result.booking.time || selectedSlotLabel,
          name: name.trim(),
          date: result.booking.date || selectedDate,
          status: result.booking.status,
        },
      })
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Could not create booking.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <Screen
        scroll
        contentStyle={[
          styles.scroll,
          keyboardHeight > 0
            ? { paddingBottom: Math.max(130, keyboardHeight + 100) }
            : null,
        ]}
      >
        <Text variant="title">Reserve your visit</Text>
        <Text muted style={styles.gap}>
          {step === 0
            ? "Review your services"
            : step === 1
              ? "Pick a date and time"
              : "Confirm and book"}
        </Text>

        {step === 0 ? (
        <>
        <View style={styles.card}>
          <View style={styles.salonRow}>
            <Image
              source={{ uri: salon.imageUrl || salon.coverImageUrl }}
              style={styles.salonAvatar}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.salonCopy}>
              <Text variant="label" muted>
                Salon
              </Text>
              <Text variant="heading" numberOfLines={1}>
                {salon.name}
              </Text>
              <Text muted numberOfLines={1}>
                {salon.area}, {salon.city}
              </Text>
              <Text variant="caption" muted numberOfLines={2}>
                {salon.address}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Text variant="label" muted>
              Services / package
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: "/salon/[id]", params: { id: salon.id } })
              }
            >
              <Text variant="caption" color={colors.primary}>
                Edit
              </Text>
            </Pressable>
          </View>

          {selectedPackage ? (
            <View style={styles.serviceCard}>
              <Image
                source={{ uri: selectedPackage.imageUrl || salon.imageUrl }}
                style={styles.serviceThumb}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.serviceCopy}>
                <Text variant="bodyStrong">{selectedPackage.name}</Text>
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
                onPress={() => cart.setPackage(salon.id, null)}
                style={styles.removeBtn}
              >
                <Icon name="close" size={16} color={colors.textSubtle} />
              </Pressable>
            </View>
          ) : null}

          {selectedServices.map((service) => {
            const optionId = salonCart?.priceOptionIds[service.id] ?? null
            return (
            <View key={service.id} style={styles.serviceCard}>
              <Image
                source={{ uri: service.imageUrl || salon.imageUrl }}
                style={styles.serviceThumb}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.serviceCopy}>
                <Text variant="bodyStrong">{service.name}</Text>
                <Text variant="caption" muted>
                  {serviceCartCaption(service, salonCart?.quantities, optionId)}
                </Text>
                <Text variant="bodyStrong">
                  {formatRupees(
                    serviceLineAmount(service, salonCart?.quantities, optionId),
                  )}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${service.name}`}
                hitSlop={8}
                onPress={() => cart.toggleService(salon.id, service.id)}
                style={styles.removeBtn}
              >
                <Icon name="close" size={16} color={colors.textSubtle} />
              </Pressable>
            </View>
            )
          })}

          {!hasSelection ? (
            <>
              <Text muted>Select services on the salon page to continue.</Text>
              <Button
                label="Browse services"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: "/salon/[id]", params: { id: salon.id } })
                }
              />
            </>
          ) : null}
        </View>
        </>
        ) : null}

        {step === 2 ? (
        <>
        <View style={styles.card}>
          <Text variant="label" muted>
            Your visit
          </Text>
          <Text variant="bodyStrong" numberOfLines={2}>
            {selectedPackage
              ? selectedPackage.name
              : selectedServices.map((s) => s.name).join(" · ") || "Services"}
          </Text>
          <Text variant="caption" muted style={{ marginTop: 4 }}>
            {selectedDate && slotValue
              ? `${formatDayChip(selectedDate)} · ${selectedSlotLabel}`
              : "Date and time"}
            {selectedPackage
              ? ""
              : selectedStaffName
                ? ` · ${selectedStaffName}`
                : " · Any specialist"}
          </Text>
        </View>
        <View style={styles.card}>
          <Text variant="label" muted>
            Customer info
          </Text>
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoComplete="name"
          />
          <Input
            label="Phone"
            value={
              normalizeMobileDigits(phone).length >= 10
                ? `+91 ${normalizeMobileDigits(phone)}`
                : phone
            }
            editable={false}
            selectTextOnFocus={false}
            keyboardType="phone-pad"
            placeholder="Verified mobile"
            style={styles.lockedInput}
          />
          <Input
            label="Email (required)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@email.com"
            hint="We'll send your invoice to this email."
            error={email.trim() && !isValidEmail(email) ? "Check the email, it doesn't look complete." : null}
          />
          <Pressable
            onPress={() => setMarketingOptIn((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marketingOptIn }}
            accessibilityLabel={`Send me offers and updates from ${salon.name} on WhatsApp`}
            style={({ pressed }) => [
              styles.optInRow,
              marketingOptIn && styles.optInRowActive,
              pressed && styles.optInPressed,
            ]}
          >
            <Icon
              name={marketingOptIn ? "checkbox" : "square-outline"}
              size={22}
              color={marketingOptIn ? colors.primary : colors.textSubtle}
            />
            <View style={styles.optInCopy}>
              <Text variant="bodyStrong">
                Send me offers and updates from {salon.name} on WhatsApp
              </Text>
              <Text variant="caption" muted>
                Promotional messages only. Booking confirmations and reminders are always sent when you book.
              </Text>
            </View>
          </Pressable>
        </View>
        </>
        ) : null}

        {step === 1 ? (
        <View style={styles.card}>
          <Text variant="label" muted>
            Appointment
          </Text>
          {!selectedPackage ? (
            <>
              <Text variant="caption" muted>
                Preferred specialist
              </Text>
              {noStaffForServices ? (
                <Text variant="caption" color={colors.destructive}>
                  {slotsMessage?.trim() || NO_STAFF_MESSAGE}
                </Text>
              ) : (
                <View style={styles.chips}>
                  {bookableStaff.length > 1 ? (
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.chip, !staffId && styles.chipActive]}
                      onPress={() => setStaffId(null)}
                    >
                      <View style={styles.staffChip}>
                        <View style={styles.staffAnyAvatar}>
                          <Icon
                            name="people-outline"
                            size={16}
                            color={!staffId ? colors.primary : colors.textMuted}
                          />
                        </View>
                        <View style={{ minWidth: 0, maxWidth: 120 }}>
                          <Text variant="caption" numberOfLines={1}>
                            Any
                          </Text>
                          <Text variant="caption" muted numberOfLines={1}>
                            Available
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ) : null}
                  {bookableStaff.map((member) => {
                    const photo = member.imageUrl
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={member.id}
                        style={[
                          styles.chip,
                          staffId === member.id && styles.chipActive,
                        ]}
                        onPress={() => setStaffId(member.id)}
                      >
                        <View style={styles.staffChip}>
                          {photo ? (
                            <Image
                              source={{ uri: photo }}
                              style={styles.staffPhoto}
                              contentFit="cover"
                              transition={200}
                            />
                          ) : (
                            <View style={styles.staffAnyAvatar}>
                              <Icon
                                name="person-outline"
                                size={16}
                                color={staffId === member.id ? colors.primary : colors.textMuted}
                              />
                            </View>
                          )}
                          <View style={{ minWidth: 0, maxWidth: 120 }}>
                            <Text variant="caption" numberOfLines={1}>
                              {member.name}
                            </Text>
                            {member.role ? (
                              <Text variant="caption" muted numberOfLines={1}>
                                {member.role}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              )}
            </>
          ) : null}
          <BookingSelectTrigger
            label="Date"
            icon="calendar-outline"
            value={selectedDate && !noStaffForServices ? formatDayChip(selectedDate) : ""}
            placeholder={
              !hasSelection
                ? "Select services first"
                : noStaffForServices
                  ? "Unavailable"
                  : "Select date"
            }
            disabled={!hasSelection || noStaffForServices || availabilityDays.length === 0}
            onPress={() => setDateSheetOpen(true)}
          />
          <BookingSelectTrigger
            label="Time"
            icon="time-outline"
            value={
              slotValue && !noStaffForServices
                ? slots.find((slot) => slot.value === slotValue)?.label ??
                  slotValue
                : ""
            }
            placeholder={
              noStaffForServices
                ? "Unavailable"
                : !selectedDate
                  ? "Pick a date first"
                  : slotsLoading
                    ? "Loading available times…"
                    : slotsMessage
                      ? slotsMessage
                      : slots.length === 0
                        ? "No times available"
                        : "Select time"
            }
            disabled={
              !hasSelection ||
              noStaffForServices ||
              !selectedDate ||
              slotsLoading ||
              Boolean(slotsMessage) ||
              slots.length === 0
            }
            onPress={() => setTimeSheetOpen(true)}
          />
          {selectedDate && !slotsLoading && !noStaffForServices && hasSelection && slots.length === 0 && salonId ? (
            <WaitlistPrompt
              kind="salon"
              provider={salonId}
              date={selectedDate}
              serviceIds={cart.getCart(salonId)?.serviceIds ?? []}
            />
          ) : null}
          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything we should know"
          />
        </View>
        ) : null}

        {step === 2 ? (
        <>
        <View style={styles.card}>
          <Text variant="label" muted>
            Promo code
          </Text>
          {appliedPromoCode ? (
            <View style={styles.appliedPromo}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{appliedPromoCode}</Text>
                {appliedDiscount ? (
                  <Text variant="caption" muted>
                    {appliedDiscount.title} · −{formatRupees(promoDiscount)}
                  </Text>
                ) : cashbackClaim ? (
                  <Text variant="caption" muted>
                    ₹{cashbackClaim.cashbackRupees} wallet cashback after visit
                  </Text>
                ) : null}
              </View>
              <Pressable accessibilityRole="button" onPress={clearPromo} hitSlop={8} style={styles.removePromo}>
                <Text variant="caption" color={colors.destructive}>
                  Remove
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.promoRow}>
              <View style={{ flex: 1 }}>
                <Input
                  value={promoInput}
                  onChangeText={(value) => {
                    setPromoInput(value)
                    setPromoError(null)
                  }}
                  placeholder="Enter code"
                  accessibilityLabel="Promo code"
                  autoCapitalize="characters"
                />
              </View>
              <Button
                label={promoApplying ? "…" : "Apply"}
                style={styles.applyBtn}
                onPress={() => {
                  void applyPromo()
                }}
                loading={promoApplying}
                disabled={promoInput.trim().length === 0 || promoApplying}
              />
            </View>
          )}
          {promoError ? (
            <Text variant="caption" color={colors.destructive}>
              {promoError}
            </Text>
          ) : null}
          {cashbackClaim && !promoError ? (
            <Text variant="caption" muted>
              {cashbackClaim.message}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text variant="label" muted>
            Wallet & loyalty
          </Text>

          <Pressable
            accessibilityRole="button"
            style={[
              styles.rewardRow,
              useWallet && walletBalance > 0 && styles.rewardRowActive,
              walletBalance <= 0 && styles.rewardDisabled,
            ]}
            disabled={walletBalance <= 0}
            onPress={() => {
              if (walletBalance <= 0) return
              setUseWallet((value) => !value)
            }}
          >
            <View style={styles.rewardIcon}>
              <Icon name="wallet-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rewardCopy}>
              <Text variant="bodyStrong">Wallet credit</Text>
              <Text variant="caption" muted>
                {walletBalance > 0
                  ? `${formatRupees(walletBalance)} available · tap to ${useWallet ? "remove" : "apply"}`
                  : "No wallet balance yet"}
              </Text>
            </View>
            <View
              style={[
                styles.applyChip,
                useWallet && walletBalance > 0 && styles.applyChipOn,
                walletBalance <= 0 && styles.applyChipDisabled,
              ]}
            >
              <Text
                variant="caption"
                color={
                  walletBalance <= 0
                    ? colors.textSubtle
                    : useWallet
                      ? colors.primaryFg
                      : colors.primary
                }
              >
                {walletBalance <= 0 ? "Unavailable" : useWallet ? "Applied" : "Apply"}
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={[
              styles.rewardRow,
              useLoyalty && loyaltyAvailable && styles.rewardRowActive,
              (!loyaltyAvailable || selectedPackage) && styles.rewardDisabled,
            ]}
            disabled={!loyaltyAvailable || Boolean(selectedPackage)}
            onPress={() => {
              if (!loyaltyAvailable || selectedPackage) return
              setUseLoyalty((value) => !value)
            }}
          >
            <View style={styles.rewardIcon}>
              <Icon name="ribbon-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rewardCopy}>
              <Text variant="bodyStrong">Loyalty reward</Text>
              <Text variant="caption" muted>
                {selectedPackage
                  ? "Not available with packages"
                  : loyaltyAvailable
                    ? `Up to ₹${LOYALTY_DISCOUNT_CAP_RUPEES} off · ${loyalty.freeServiceCredits} credit${loyalty.freeServiceCredits === 1 ? "" : "s"} · tap to ${useLoyalty ? "remove" : "apply"}`
                    : `Complete ${LOYALTY_VISITS_PER_FREE} services → unlock up to ₹${LOYALTY_DISCOUNT_CAP_RUPEES} off. ${loyalty.stampsTowardNextFree}/${LOYALTY_VISITS_PER_FREE} completed · ${loyalty.visitsLeft} more to go.`}
              </Text>
            </View>
            <View
              style={[
                styles.applyChip,
                useLoyalty && loyaltyAvailable && styles.applyChipOn,
                (!loyaltyAvailable || selectedPackage) && styles.applyChipDisabled,
              ]}
            >
              <Text
                variant="caption"
                color={
                  !loyaltyAvailable || selectedPackage
                    ? colors.textSubtle
                    : useLoyalty
                      ? colors.primaryFg
                      : colors.primary
                }
              >
                {!loyaltyAvailable
                  ? "Locked"
                  : useLoyalty
                    ? "Applied"
                    : "Apply"}
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text variant="label" muted>
            Payment summary
          </Text>
          <View style={styles.summaryRow}>
            <Text muted>Subtotal</Text>
            <Text>{formatRupees(subtotal)}</Text>
          </View>
          {promoDiscount > 0 && appliedDiscount ? (
            <View style={styles.summaryRow}>
              <Text muted>Promo ({appliedDiscount.code})</Text>
              <Text color={colors.success}>−{formatRupees(promoDiscount)}</Text>
            </View>
          ) : null}
          {cashbackClaim ? (
            <View style={styles.summaryRow}>
              <Text muted>Cashback ({cashbackClaim.code})</Text>
              <Text muted>+₹{cashbackClaim.cashbackRupees} later</Text>
            </View>
          ) : null}
          {loyaltyCredit > 0 ? (
            <View style={styles.summaryRow}>
              <Text muted>Loyalty</Text>
              <Text color={colors.success}>−₹{loyaltyCredit}</Text>
            </View>
          ) : null}
          {gstAmount > 0 && salonTax ? (
            <View style={styles.summaryRow}>
              <Text muted>
                GST (
                {Number.isInteger(salonTax.ratePercent)
                  ? salonTax.ratePercent
                  : salonTax.ratePercent.toFixed(2)}
                %)
              </Text>
              <Text>{formatRupees(gstAmount)}</Text>
            </View>
          ) : null}
          {walletCredit > 0 ? (
            <View style={styles.summaryRow}>
              <Text muted>Wallet</Text>
              <Text color={colors.success}>−₹{walletCredit}</Text>
            </View>
          ) : null}
          {advanceDue > 0 && advanceConfig ? (
            <>
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text variant="bodyStrong">Pay now to confirm</Text>
                <Text variant="heading">{formatRupees(advanceDue)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text muted>Pay at salon</Text>
                <Text>{formatRupees(Math.max(0, total - advanceDue))}</Text>
              </View>
              <View style={{ gap: 2, marginTop: 4 }}>
                <Text variant="caption" muted>
                  You&apos;ll pay the advance right after booking. Your time is held for 15 minutes.
                </Text>
                <Text variant="label">If you cancel</Text>
                {salonAdvancePolicyLines(advanceConfig.policy).map((line) => (
                  <Text key={line} variant="caption" muted>{`• ${line}`}</Text>
                ))}
              </View>
            </>
          ) : (
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text variant="bodyStrong">Pay at salon</Text>
              <Text variant="heading">{formatRupees(total)}</Text>
            </View>
          )}
        </View>
        </>
        ) : null}
      </Screen>

      <BookingDateSheet
        visible={dateSheetOpen}
        options={dateOptions}
        value={selectedDate}
        onClose={() => setDateSheetOpen(false)}
        onSelect={(date) => {
          setSlotValue(null)
          setDateOverride(date)
        }}
      />
      <BookingTimeSheet
        visible={timeSheetOpen}
        options={slots.map((slot) => ({
          value: slot.value,
          label: slot.label,
        }))}
        value={slotValue}
        emptyMessage={slotsMessage || "No time slots for this day."}
        onClose={() => setTimeSheetOpen(false)}
        onSelect={setSlotValue}
        onClear={() => setSlotValue(null)}
      />

      <BookingConfirmSheet
        visible={confirmSheetOpen}
        onClose={() => {
          if (submitting) return
          setConfirmSheetOpen(false)
          setSubmitError(null)
        }}
        salonName={salon.name}
        salonArea={`${salon.area}, ${salon.city}`}
        salonImageUrl={salon.imageUrl || salon.coverImageUrl}
        serviceLines={confirmServiceLines}
        dateLabel={selectedDate ? formatDayChip(selectedDate) : "—"}
        timeLabel={selectedSlotLabel}
        staffLabel={selectedPackage ? null : selectedStaffName}
        customerName={name.trim() || "—"}
        customerPhone={
          normalizeMobileDigits(phone).length >= 10
            ? `+91 ${normalizeMobileDigits(phone)}`
            : phone || "—"
        }
        customerEmail={email.trim() || "—"}
        notes={notes.trim() || null}
        priceLines={confirmPriceLines}
        totalLabel={`${formatRupees(total)}`}
        submitting={submitting}
        error={submitError}
        onConfirm={() => {
          void submitBooking()
        }}
      />

      <PromoSuccessCelebration
        visible={promoCelebration != null}
        payload={promoCelebration}
        onClose={() => setPromoCelebration(null)}
      />

      <StickyCta
        title={
          step === 0
            ? hasSelection
              ? `Continue · ${formatRupees(total)}`
              : "Select services to continue"
            : step === 1
              ? selectedDate && slotValue
                ? `${formatDayChip(selectedDate)} · ${selectedSlotLabel}`
                : "Pick a date and time"
              : `Book · pay at salon ${formatRupees(total)}`
        }
        subtitle={
          phoneMissing
            ? "Sign in again to restore your verified mobile"
            : step === 0
              ? "Next · choose date and time"
              : step === 1
                ? "Next · confirm your booking"
                : name.trim().length < 2
                  ? "Add your name to book"
                  : !isValidEmail(email)
                    ? "Add a valid email to book. Your invoice goes there."
                    : hasSelection && selectedDate && slotValue
                  ? `${formatDayChip(selectedDate)} · ${selectedSlotLabel}`
                  : "Review details below"
        }
        error={step === 2 && !confirmSheetOpen ? submitError : null}
        label={step < 2 ? "Continue" : advanceDue > 0 ? `Book and pay ${formatRupees(advanceDue)}` : "Book"}
        bottomOffset={keyboardHeight}
        disabled={
          submitting ||
          phoneMissing ||
          (step === 0 && !hasSelection) ||
          (step === 1 &&
            (!hasSelection ||
              noStaffForServices ||
              !selectedDate ||
              !slotValue)) ||
          (step === 2 &&
            (!hasSelection ||
              noStaffForServices ||
              !selectedDate ||
              !slotValue ||
              name.trim().length < 2 ||
              normalizeMobileDigits(phone).length < 10 ||
              !isValidEmail(email)))
        }
        onPress={() => {
          if (step === 0) {
            if (hasSelection) setStep(1)
            return
          }
          if (step === 1) {
            if (selectedDate && slotValue) setStep(2)
            return
          }
          setSubmitError(null)
          setConfirmSheetOpen(true)
        }}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingBottom: 130,
    paddingTop: 0,
  },
  gap: {
    marginTop: spacing.sm,
  },
  lockedInput: {
    backgroundColor: colors.muted,
    color: colors.textMuted,
  },
  optInRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optInRowActive: {
    borderColor: colors.primary,
    backgroundColor: "#F1F1F1",
  },
  optInPressed: {
    opacity: 0.94,
  },
  optInCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  card: {
    marginTop: spacing.xl,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  salonRow: {
    flexDirection: "row",
    gap: spacing.lg,
    alignItems: "center",
  },
  salonAvatar: {
    width: 84,
    height: 84,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
  },
  salonCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  serviceThumb: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  serviceCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: "#F1F1F1",
  },
  chipDisabled: {
    opacity: 0.45,
  },
  staffChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  staffPhoto: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
  },
  staffAnyAvatar: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  promoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  applyBtn: {
    minWidth: 96,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  appliedPromo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "#EEF6F1",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  removePromo: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rewardRowActive: {
    borderColor: colors.primary,
    backgroundColor: "#F1F1F1",
  },
  rewardDisabled: {
    opacity: 0.55,
  },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: "#F1F1F1",
    alignItems: "center",
    justifyContent: "center",
  },
  rewardCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  applyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  applyChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  applyChipDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTotal: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
})
