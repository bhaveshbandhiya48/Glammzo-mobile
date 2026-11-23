import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"

import { BookingConfirmSheet } from "@/components/book/BookingConfirmSheet"
import {
  bk,
  BookingBar,
  BookingCard,
  BookingHeader,
  BookingSectionLabel,
  BookingSkeleton,
  bookingStyles,
  CheckRow,
  DayStrip,
  DayStripSkeleton,
  Hairline,
  Notice,
  PlaceRow,
  ReceiptRow,
  ReceiptTotal,
  ServiceLine,
  StylistPicker,
  TimeGrid,
  ToggleRow,
} from "@/components/book/BookingUi"
import { WaitlistPrompt } from "@/components/book/WaitlistPrompt"
import {
  PromoSuccessCelebration,
  type PromoCelebrationPayload,
} from "@/components/book/PromoSuccessCelebration"
import { PastelIcon } from "@/components/profile/ProfileParts"
import { EmptyState, Field } from "@/components/profile/ProfileScreenParts"
import { pastels, ui } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { OneTapPayBar } from "@/components/payments/OneTapPayBar"
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
} from "@/lib/promo-api"
import { CheckoutOffers } from "@/components/app-offers/CheckoutOffers"
import { useCheckoutAppOffers } from "@/components/app-offers/useCheckoutAppOffers"
import { getSalonByIdLive } from "@/lib/salons-api"
import {
  cartServicesSubtotal,
  defaultPriceOptionId,
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
import { fontFamily } from "@/theme/tokens"
import { formatDuration } from "@/lib/booking-display"

const STEPS = ["Services", "Date & time", "Confirm"]

function formatDayChip(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function firstParam(value: string | string[] | undefined) {
  const first = Array.isArray(value) ? value[0] : value
  return first?.trim() ? first.trim() : undefined
}

/** `a,b,c` → ids. */
function parseIdList(raw: string | undefined) {
  return (raw ?? "").split(",").map((id) => id.trim()).filter(Boolean)
}

/** `id:3,id2:x` (website `qty` / `opts` format) → { id: "3", id2: "x" }. */
function parseIdValuePairs(raw: string | undefined) {
  const next: Record<string, string> = {}
  for (const part of parseIdList(raw)) {
    const colon = part.lastIndexOf(":")
    if (colon <= 0) continue
    const id = part.slice(0, colon).trim()
    const value = part.slice(colon + 1).trim()
    if (id && value) next[id] = value
  }
  return next
}

/** This screen's path with its link params, so login comes back to the same booking. */
function bookingLinkPath(salonId: string, params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams()
  for (const key of ["staffId", "serviceIds", "packageId", "promo", "qty", "opts"]) {
    const value = firstParam(params[key])
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return `/book/${encodeURIComponent(salonId)}${qs ? `?${qs}` : ""}`
}

const NO_STAFF_MESSAGE =
  "This category has no staff assigned, so date and time can’t be selected. Choose another service or contact the salon."

export default function BookingScreen() {
  const router = useRouter()
  // `staffId` comes from Book again: keep the same stylist when they still do these services.
  // `serviceIds`, `packageId`, `promo`, `qty` and `opts` come from website booking links
  // (glammzo.com/book/<salonId>?services=…), mapped in app/+native-intent.ts.
  const params = useLocalSearchParams<{
    salonId: string
    staffId?: string
    serviceIds?: string
    packageId?: string
    promo?: string
    qty?: string
    opts?: string
  }>()
  const { salonId } = params
  const staffParam = firstParam(params.staffId)
  const linkServiceIds = firstParam(params.serviceIds)
  const linkPackageId = firstParam(params.packageId)
  const linkPromo = firstParam(params.promo)
  const linkQty = firstParam(params.qty)
  const linkOpts = firstParam(params.opts)
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
  /**
   * Stylist we picked for the customer because only one can do these services.
   * Slots for "any available" already cover that stylist, so picking them must
   * not trigger a second availability request (that refetch made times show up
   * seconds after the days).
   */
  const [autoStaffId, setAutoStaffId] = useState<string | null>(null)
  const availabilityStaffId = staffId && staffId === autoStaffId ? null : staffId
  const [useWallet, setUseWallet] = useState(false)
  const [useLoyalty, setUseLoyalty] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(EMPTY_LOYALTY_SUMMARY)
  const [walletBalance, setWalletBalance] = useState(0)
  const [phoneMissing, setPhoneMissing] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  /** Profile already had a name and email: show "Booking for … · Edit" instead of the form. */
  const [detailsFromProfile, setDetailsFromProfile] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  /** The held booking's confirmation, for after the one-tap advance payment. */
  const advanceConfirmation = useRef<Record<string, string> | null>(null)
  const [step, setStep] = useState(0)

  function leaveScreen() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/explore")
  }

  /** Header back: previous step first, then leave the screen. */
  function goBack() {
    if (step > 0) setStep((prev) => prev - 1)
    else leaveScreen()
  }

  useEffect(() => {
    let active = true
    getAccessToken().then(async (token) => {
      if (!active) return
      if (!token) {
        router.replace({
          pathname: "/login",
          params: { next: bookingLinkPath(salonId, params) },
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
      setDetailsFromProfile(nextName.length >= 2 && isValidEmail(nextEmail))
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

  // Website booking link: add the linked services to this salon's bag once. Bags are kept per
  // salon, so another salon's bag is left alone; services already in this bag are kept as they
  // are. Unknown ids are ignored; if nothing matches, the usual empty bag shows.
  const linkSeedKey = useRef<string | null>(null)
  useEffect(() => {
    if (!salon || !cart.hydrated) return
    if (!linkServiceIds && !linkPackageId && !linkPromo) return
    const key = [salon.id, linkServiceIds, linkPackageId, linkQty, linkOpts, linkPromo].join("|")
    if (linkSeedKey.current === key) return
    linkSeedKey.current = key

    const existing = cart.getCart(salon.id)
    const quantities = parseIdValuePairs(linkQty)
    const options = parseIdValuePairs(linkOpts)
    for (const id of parseIdList(linkServiceIds)) {
      const service = salon.services.find((item) => item.id === id)
      if (!service) continue
      if (!existing?.serviceIds.includes(id)) {
        const linkedOption = options[id]
        const optionValid = service.priceOptions?.some((option) => option.id === linkedOption)
        cart.toggleService(salon.id, id, {
          priceOptionId: optionValid ? linkedOption : defaultPriceOptionId(service),
        })
      }
      const quantity = Number(quantities[id])
      if (Number.isFinite(quantity) && quantity > 1) {
        cart.setServiceQuantity(salon.id, id, Math.floor(quantity), service.pricingUnit)
      }
    }
    if (linkPackageId && salon.packages.some((item) => item.id === linkPackageId)) {
      cart.setPackage(salon.id, linkPackageId)
    }
    if (linkPromo?.trim()) {
      setPromoInput((current) => current || linkPromo.trim())
    }
  }, [salon, cart, linkServiceIds, linkPackageId, linkQty, linkOpts, linkPromo])

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
  }, [serviceIdsForAvailability.join(","), selectedPackage?.id, availabilityStaffId])

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
      staffId: availabilityStaffId,
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
    availabilityStaffId,
    dateOverride,
  ])

  useEffect(() => {
    if (bookableStaff.length === 1) {
      const onlyId = bookableStaff[0]!.id
      if (staffId !== onlyId) {
        setStaffId(onlyId)
        setAutoStaffId(onlyId)
      }
      return
    }
    if (autoStaffId) {
      // More stylists now fit: drop the one we picked so the choice is the customer's.
      setAutoStaffId(null)
      if (staffId === autoStaffId) {
        setStaffId(null)
        return
      }
    }
    if (staffId && bookableStaff.length > 0 && !bookableStaff.some((member) => member.id === staffId)) {
      setStaffId(null)
    }
  }, [bookableStaff, staffId, autoStaffId])

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

  const appOffersServicePriceOptionIds =
    salon && selectedPackage
      ? withDefaultPriceOptionIds(salon.services, serviceIdsForAvailability, salonCart?.priceOptionIds)
      : salonCart?.priceOptionIds
  const appOffers = useCheckoutAppOffers(
    salon && serviceIdsForAvailability.length > 0
      ? {
          scope: "salon",
          salonId: salon.id,
          serviceIds: serviceIdsForAvailability,
          packageId: selectedPackage?.id ?? null,
          serviceQuantities: salonCart?.quantities,
          servicePriceOptionIds: appOffersServicePriceOptionIds,
          partnerCode: appliedDiscount?.code ?? null,
        }
      : null,
  )

  const loyaltyAvailable = canApplyLoyalty(loyalty)
  const afterPromo = appliedDiscount?.finalTotal ?? subtotal
  const promoDiscount = appliedDiscount?.discountAmount ?? 0
  const appliedPromoCode = appliedDiscount?.code ?? null
  const appOfferDiscount = Math.min(appOffers.discountRupees, Math.max(afterPromo, 0))
  const loyaltyCredit =
    useLoyalty && loyaltyAvailable && !selectedPackage
      ? Math.min(LOYALTY_DISCOUNT_CAP_RUPEES, Math.max(afterPromo, 0))
      : 0
  const taxableAmount = Math.max(0, afterPromo - appOfferDiscount - loyaltyCredit)
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
      // Glammzo offer codes first; anything else is the salon's own code.
      const glammzo = await appOffers.tryCode(code)
      if (glammzo.ok) {
        setPromoInput("")
        setPromoCelebration({ kind: "app_offer", offer: glammzo.offer })
        return
      }
      if (glammzo.error !== "not_found") {
        setPromoError(glammzo.error)
        return
      }
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

      setAppliedDiscount(result.discount)
      setPromoInput(result.discount.code)
      setPromoCelebration({ kind: "discount", discount: result.discount })
    } catch (err) {
      setAppliedDiscount(null)
      setPromoError(err instanceof ApiError ? err.message : "Could not apply promo code.")
    } finally {
      setPromoApplying(false)
    }
  }

  function clearPromo() {
    setAppliedDiscount(null)
    setPromoInput("")
    setPromoError(null)
  }

  // Keep applied promo in sync when cart services/package change (match web).
  useEffect(() => {
    if (!salon || !appliedDiscount) return
    const code = appliedDiscount.code
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
        setAppliedDiscount(result.discount)
        setPromoError(null)
      })
      .catch((err) => {
        if (!active) return
        setAppliedDiscount(null)
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
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingSkeleton />
      </>
    )
  }

  if (!salon) {
    return (
      <View style={bookingStyles.page}>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingHeader title="Book your visit" onBack={leaveScreen} />
        <View style={styles.pad}>
          <EmptyState
            pastel={pastels.peach}
            icon="storefront-outline"
            title="Salon unavailable"
            text="This salon can’t take bookings right now."
            ctaLabel="Browse salons"
            onCta={() => router.replace("/(tabs)/explore")}
          />
        </View>
      </View>
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
  const itemCount = selectedPackage ? 1 : selectedServices.length

  const confirmServiceLines = selectedPackage
    ? [
        {
          title: selectedPackage.name,
          subtitle: `Package · ${formatDuration(selectedPackage.totalDurationMin)}`,
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
    ...(appOfferDiscount > 0 && appOffers.applied
      ? [
          {
            label: `Glammzo offer (${appOffers.applied.headline})`,
            value: `−${formatRupees(appOfferDiscount)}`,
            success: true,
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

  /** One-tap pay: creates the booking (holding the slot) and returns its advance token. */
  async function reserveForAdvance(): Promise<string | null> {
    return submitBooking({ forAdvance: true })
  }

  function onAdvancePaid(paidRupees: number) {
    const details = advanceConfirmation.current
    if (!details) return
    if (salon) cart.clearSalon(salon.id)
    router.replace({
      pathname: "/book/confirmation",
      params: { ...details, status: "confirmed", advancePaid: String(paidRupees) },
    } as Href)
  }

  async function submitBooking(options?: { forAdvance?: boolean }): Promise<string | null> {
    if (submitting || !salon || !selectedDate || !slotValue) return null
    const customerPhone = normalizeMobileDigits(phone)
    if (customerPhone.length < 10 || !isValidEmail(email)) {
      setSubmitError(
        customerPhone.length < 10
          ? "Verified mobile is missing. Please sign in again."
          : "Enter a valid email for your invoice.",
      )
      return null
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
        appOffer: appOffers.selection,
        useWallet: useWallet && walletBalance > 0,
        useFreeService: useLoyalty && loyaltyAvailable,
        marketingOptIn,
        serviceQuantities: salonCart?.quantities,
        servicePriceOptionIds,
      })
      // Keep profile in sync when the guest adds/updates email at checkout.
      void syncProfileEmailFromBooking(email)
      // One-tap pay keeps the cart until the advance is paid, so the bar can retry.
      if (!options?.forAdvance) cart.clearSalon(salon.id)
      setConfirmSheetOpen(false)
      const confirmation = {
        salonId: salon.id,
        bookingId: result.booking.id,
        total: String(result.booking.price ?? total),
        slot: result.booking.time || selectedSlotLabel,
        name: name.trim(),
        date: result.booking.date || selectedDate,
      }
      if (options?.forAdvance && !result.booking.advanceToken) cart.clearSalon(salon.id)
      // One-tap pay bar: it takes the payment from here, on this screen.
      if (options?.forAdvance && result.booking.advanceToken) {
        advanceConfirmation.current = { ...confirmation, payToken: result.booking.advanceToken }
        return result.booking.advanceToken
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
        return null
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
      return null
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Could not create booking.",
      )
      return null
    } finally {
      setSubmitting(false)
    }
  }

  const phoneDigits = normalizeMobileDigits(phone)
  const showOneTap = step === 2 && advanceDue > 0
  const visitWhen =
    selectedDate && slotValue ? `${formatDayChip(selectedDate)} · ${selectedSlotLabel}` : null

  const barDisabled =
    submitting ||
    phoneMissing ||
    (step === 0 && !hasSelection) ||
    (step === 1 && (!hasSelection || noStaffForServices || !selectedDate || !slotValue)) ||
    (step === 2 &&
      (!hasSelection ||
        noStaffForServices ||
        !selectedDate ||
        !slotValue ||
        name.trim().length < 2 ||
        phoneDigits.length < 10 ||
        !isValidEmail(email)))

  const barTitle =
    step === 0
      ? hasSelection
        ? formatRupees(total)
        : "Your bag is empty"
      : step === 1
        ? visitWhen ?? "Pick a date and time"
        : formatRupees(total)

  const barCaption = phoneMissing
    ? "Sign in again to restore your verified mobile"
    : step === 0
      ? hasSelection
        ? `${itemCount} ${itemCount === 1 ? "item" : "items"} · Next: date and time`
        : "Add services on the salon page"
      : step === 1
        ? visitWhen
          ? `${selectedPackage ? "" : selectedStaffName ? `${selectedStaffName} · ` : ""}Next: confirm`
          : "Choose a day, then a time"
        : name.trim().length < 2
          ? "Add your name to book"
          : !isValidEmail(email)
            ? "Add a valid email to book. Your invoice goes there."
            : "Pay at the salon after your visit"

  function onBarPress() {
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
  }

  return (
    <View style={bookingStyles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, showOneTap && styles.scrollOneTap]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <BookingHeader
            title="Book your visit"
            subtitle={salon.name}
            step={step}
            steps={STEPS}
            onBack={goBack}
            backLabel={step > 0 ? `Back to ${STEPS[step - 1]}` : "Go back"}
          />

          {step === 0 ? (
            <View style={styles.pad}>
              <BookingSectionLabel first>Your salon</BookingSectionLabel>
              <BookingCard>
                <PlaceRow
                  imageUrl={salon.imageUrl || salon.coverImageUrl}
                  name={salon.name}
                  caption={`${salon.area}, ${salon.city}`}
                  meta={salon.address}
                />
              </BookingCard>

              <BookingSectionLabel
                action={
                  hasSelection
                    ? {
                        label: "Add more",
                        onPress: () =>
                          router.push({ pathname: "/salon/[id]", params: { id: salon.id } }),
                      }
                    : undefined
                }
              >
                Your bag
              </BookingSectionLabel>
              {hasSelection ? (
                <BookingCard>
                  {selectedPackage ? (
                    <ServiceLine
                      imageUrl={selectedPackage.imageUrl || salon.imageUrl}
                      tag="Package"
                      title={selectedPackage.name}
                      caption={
                        selectedPackage.totalDurationMin > 0
                          ? formatDuration(selectedPackage.totalDurationMin)
                          : null
                      }
                      price={`₹${selectedPackage.packagePrice}`}
                      onRemove={() => cart.setPackage(salon.id, null)}
                    />
                  ) : null}
                  {selectedServices.map((service, index) => {
                    const optionId = salonCart?.priceOptionIds[service.id] ?? null
                    return (
                      <View key={service.id} style={styles.lineGap}>
                        {index > 0 || selectedPackage ? <Hairline /> : null}
                        <ServiceLine
                          imageUrl={service.imageUrl || salon.imageUrl}
                          title={service.name}
                          caption={serviceCartCaption(service, salonCart?.quantities, optionId)}
                          price={formatRupees(
                            serviceLineAmount(service, salonCart?.quantities, optionId),
                          )}
                          onRemove={() => cart.toggleService(salon.id, service.id)}
                        />
                      </View>
                    )
                  })}
                  <ReceiptTotal
                    label="Subtotal"
                    value={formatRupees(subtotal)}
                    caption="Offers, wallet and taxes on the last step"
                  />
                </BookingCard>
              ) : (
                <EmptyState
                  pastel={pastels.pink}
                  icon="bag-handle-outline"
                  title="Your bag is empty"
                  text="Select services on the salon page to continue."
                  ctaLabel="Browse services"
                  onCta={() =>
                    router.push({ pathname: "/salon/[id]", params: { id: salon.id } })
                  }
                />
              )}
            </View>
          ) : null}

          {step === 1 ? (
            <>
              {!selectedPackage ? (
                <>
                  <View style={styles.pad}>
                    <BookingSectionLabel first>Choose your stylist</BookingSectionLabel>
                  </View>
                  {noStaffForServices ? (
                    <View style={styles.pad}>
                      <Notice tone="red" icon="alert-circle-outline">
                        {slotsMessage?.trim() || NO_STAFF_MESSAGE}
                      </Notice>
                    </View>
                  ) : bookableStaff.length > 0 ? (
                    <StylistPicker
                      staff={bookableStaff}
                      value={staffId}
                      onSelect={(id) => {
                        setAutoStaffId(null)
                        setStaffId(id)
                      }}
                      showAny={bookableStaff.length > 1}
                    />
                  ) : (
                    <View style={styles.pad}>
                      <View style={styles.ghostRow} />
                    </View>
                  )}
                </>
              ) : null}

              <View style={styles.pad}>
                <BookingSectionLabel first={Boolean(selectedPackage)}>Pick a day</BookingSectionLabel>
              </View>
              {!hasSelection ? (
                <View style={styles.pad}>
                  <Notice tone="grey">Select services first.</Notice>
                </View>
              ) : noStaffForServices ? (
                <View style={styles.pad}>
                  <Notice tone="grey">Dates aren’t available for these services.</Notice>
                </View>
              ) : dateOptions.length === 0 ? (
                slotsLoading ? (
                  <DayStripSkeleton />
                ) : (
                  <View style={styles.pad}>
                    <Notice tone="grey">No dates available for this booking yet.</Notice>
                  </View>
                )
              ) : (
                <DayStrip
                  options={dateOptions}
                  value={selectedDate}
                  onSelect={(date) => {
                    // Same day, or a request for it is already on its way.
                    if (date === selectedDate || date === dateOverride) return
                    // Show the new day and the time placeholder in the same frame,
                    // instead of the old times lingering until the effect runs.
                    setSelectedDate(date)
                    setSlotValue(null)
                    setSlots([])
                    setSlotsMessage(null)
                    setSlotsLoading(true)
                    setDateOverride(date)
                  }}
                />
              )}

              <View style={styles.pad}>
                <BookingSectionLabel>Pick a time</BookingSectionLabel>
                {!hasSelection || noStaffForServices ? (
                  <Notice tone="grey">Times show up once a day is picked.</Notice>
                ) : !selectedDate && !slotsLoading ? (
                  <Notice tone="grey">Pick a day first.</Notice>
                ) : slotsMessage && !slotsLoading ? (
                  <Notice tone="peach" icon="time-outline">
                    {slotsMessage}
                  </Notice>
                ) : (
                  <TimeGrid
                    options={slots.map((slot) => ({ value: slot.value, label: slot.label }))}
                    value={slotValue}
                    onSelect={setSlotValue}
                    loading={slotsLoading}
                    emptyMessage="No time slots for this day."
                  />
                )}
                {selectedDate &&
                !slotsLoading &&
                !noStaffForServices &&
                hasSelection &&
                slots.length === 0 &&
                salonId ? (
                  <View style={styles.waitlist}>
                    <WaitlistPrompt
                      kind="salon"
                      provider={salonId}
                      date={selectedDate}
                      serviceIds={cart.getCart(salonId)?.serviceIds ?? []}
                    />
                  </View>
                ) : null}

                <BookingSectionLabel>Notes for the salon</BookingSectionLabel>
                <Field
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Anything we should know (optional)"
                  accessibilityLabel="Notes"
                  multiline
                />
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <View style={styles.pad}>
              <BookingSectionLabel first action={{ label: "Change", onPress: () => setStep(1) }}>
                Your visit
              </BookingSectionLabel>
              <BookingCard>
                <PlaceRow
                  imageUrl={salon.imageUrl || salon.coverImageUrl}
                  name={salon.name}
                  caption={`${salon.area}, ${salon.city}`}
                />
                <Hairline />
                <VisitFact
                  icon="sparkles-outline"
                  text={
                    selectedPackage
                      ? selectedPackage.name
                      : selectedServices.map((s) => s.name).join(" · ") || "Services"
                  }
                />
                <VisitFact icon="calendar-outline" text={visitWhen ?? "Date and time"} />
                {!selectedPackage ? (
                  <VisitFact icon="person-outline" text={selectedStaffName ?? "Any specialist"} />
                ) : null}
              </BookingCard>

              <BookingSectionLabel
                action={
                  detailsFromProfile && !editingDetails
                    ? { label: "Edit", onPress: () => setEditingDetails(true) }
                    : undefined
                }
              >
                Booking for
              </BookingSectionLabel>
              <BookingCard>
                {detailsFromProfile && !editingDetails ? (
                  <View style={styles.bookingFor}>
                    <PastelIcon pastel={pastels.lavender} name="person-outline" />
                    <View style={styles.bookingForCopy}>
                      <Text style={styles.strong} numberOfLines={1}>
                        {name.trim()}
                        {phoneDigits.length >= 10 ? ` · +91 ${phoneDigits}` : ""}
                      </Text>
                      <Text style={styles.muted} numberOfLines={1}>
                        Invoice to {email.trim()}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={bookingStyles.fieldStack}>
                    <Field
                      label="Name"
                      value={name}
                      onChangeText={setName}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                    <Field
                      label="Phone"
                      value={phoneDigits.length >= 10 ? `+91 ${phoneDigits}` : phone}
                      editable={false}
                      selectTextOnFocus={false}
                      keyboardType="phone-pad"
                      placeholder="Verified mobile"
                      style={styles.lockedInput}
                    />
                    <Field
                      label="Email"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      placeholder="you@email.com"
                      hint="We'll send your invoice to this email."
                      error={
                        email.trim() && !isValidEmail(email)
                          ? "Check the email, it doesn't look complete."
                          : null
                      }
                    />
                  </View>
                )}
                <Hairline />
                <CheckRow
                  checked={marketingOptIn}
                  onPress={() => setMarketingOptIn((value) => !value)}
                  title={`Send me offers and updates from ${salon.name} on WhatsApp`}
                  caption="Promotional messages only. Booking confirmations and reminders are always sent when you book."
                  accessibilityLabel={`Send me offers and updates from ${salon.name} on WhatsApp`}
                />
              </BookingCard>

              <BookingSectionLabel>Offers</BookingSectionLabel>
              <BookingCard>
                <CheckoutOffers state={appOffers} />
                {appliedPromoCode ? (
                  <View style={styles.appliedPromo}>
                    <PastelIcon pastel={pastels.mint} name="pricetag-outline" />
                    <View style={styles.bookingForCopy}>
                      <Text style={styles.strong}>{appliedPromoCode}</Text>
                      {appliedDiscount ? (
                        <Text style={styles.success}>
                          {appliedDiscount.title} · −{formatRupees(promoDiscount)}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${appliedPromoCode}`}
                      onPress={clearPromo}
                      hitSlop={8}
                    >
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.promoRow}>
                    <View style={styles.flex}>
                      <Field
                        value={promoInput}
                        onChangeText={(value) => {
                          setPromoInput(value)
                          setPromoError(null)
                        }}
                        placeholder="Enter promo code"
                        accessibilityLabel="Promo code"
                        autoCapitalize="characters"
                        error={promoError}
                      />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Apply promo code"
                      accessibilityState={{
                        disabled: promoInput.trim().length === 0 || promoApplying,
                        busy: promoApplying,
                      }}
                      disabled={promoInput.trim().length === 0 || promoApplying}
                      onPress={() => {
                        void applyPromo()
                      }}
                      style={({ pressed }) => [
                        styles.applyBtn,
                        (promoInput.trim().length === 0 || promoApplying) && styles.applyBtnOff,
                        pressed && ui.pressed,
                      ]}
                    >
                      {promoApplying ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.applyText}>Apply</Text>
                      )}
                    </Pressable>
                  </View>
                )}
                {promoError && appliedPromoCode ? (
                  <Text style={styles.error}>{promoError}</Text>
                ) : null}
                <Hairline />
                <ToggleRow
                  pastel={pastels.teal}
                  icon="wallet-outline"
                  title="Wallet credit"
                  caption={
                    walletBalance > 0
                      ? `${formatRupees(walletBalance)} available`
                      : "No wallet balance yet"
                  }
                  on={useWallet && walletBalance > 0}
                  disabled={walletBalance <= 0}
                  badge={walletBalance <= 0 ? "Unavailable" : null}
                  onPress={() => {
                    if (walletBalance <= 0) return
                    setUseWallet((value) => !value)
                  }}
                />
                <ToggleRow
                  pastel={pastels.gold}
                  icon="ribbon-outline"
                  title="Loyalty reward"
                  caption={
                    selectedPackage
                      ? "Not available with packages"
                      : loyaltyAvailable
                        ? `Up to ₹${LOYALTY_DISCOUNT_CAP_RUPEES} off · ${loyalty.freeServiceCredits} credit${loyalty.freeServiceCredits === 1 ? "" : "s"}`
                        : `Complete ${LOYALTY_VISITS_PER_FREE} services → unlock up to ₹${LOYALTY_DISCOUNT_CAP_RUPEES} off. ${loyalty.stampsTowardNextFree}/${LOYALTY_VISITS_PER_FREE} completed · ${loyalty.visitsLeft} more to go.`
                  }
                  on={useLoyalty && loyaltyAvailable}
                  disabled={!loyaltyAvailable || Boolean(selectedPackage)}
                  badge={!loyaltyAvailable ? "Locked" : selectedPackage ? "N/A" : null}
                  onPress={() => {
                    if (!loyaltyAvailable || selectedPackage) return
                    setUseLoyalty((value) => !value)
                  }}
                />
              </BookingCard>

              <BookingSectionLabel>Bill summary</BookingSectionLabel>
              <BookingCard>
                {confirmPriceLines.map((line) => (
                  <ReceiptRow
                    key={line.label}
                    label={line.label}
                    value={line.value}
                    tone={
                      "success" in line && line.success
                        ? "success"
                        : "muted" in line && line.muted
                          ? "muted"
                          : "default"
                    }
                  />
                ))}
                {advanceDue > 0 && advanceConfig ? (
                  <>
                    <ReceiptTotal label="Pay now to confirm" value={formatRupees(advanceDue)} />
                    <ReceiptRow
                      label="Pay at salon"
                      value={formatRupees(Math.max(0, total - advanceDue))}
                    />
                    <Notice tone="peach" icon="time-outline">
                      You&apos;ll pay the advance right after booking. Your time is held for 15 minutes.
                    </Notice>
                    <View style={styles.policy}>
                      <Text style={styles.policyTitle}>If you cancel</Text>
                      {salonAdvancePolicyLines(advanceConfig.policy).map((line) => (
                        <Text key={line} style={styles.muted}>{`• ${line}`}</Text>
                      ))}
                    </View>
                  </>
                ) : (
                  <ReceiptTotal
                    label="Pay at salon"
                    value={formatRupees(total)}
                    caption="Nothing to pay now"
                  />
                )}
              </BookingCard>
            </View>
          ) : null}
        </ScrollView>

        {showOneTap ? null : (
          <BookingBar
            title={barTitle}
            caption={barCaption}
            label={
              step < 2 ? "Continue" : advanceDue > 0 ? `Book and pay ${formatRupees(advanceDue)}` : "Book"
            }
            error={step === 2 && !confirmSheetOpen ? submitError : null}
            disabled={barDisabled}
            onPress={onBarPress}
          />
        )}
      </KeyboardAvoidingView>

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
        customerPhone={phoneDigits.length >= 10 ? `+91 ${phoneDigits}` : phone || "—"}
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

      {showOneTap ? (
        <OneTapPayBar
          amountRupees={advanceDue}
          reserve={reserveForAdvance}
          onPaid={onAdvancePaid}
          error={submitError}
          disabledReason={
            phoneMissing
              ? "Sign in again to restore your verified mobile"
              : name.trim().length < 2
                ? "Add your name to book."
                : !isValidEmail(email)
                  ? "Add a valid email to book. Your invoice goes there."
                  : !hasSelection || noStaffForServices || !selectedDate || !slotValue
                    ? "Pick your services, date and time to book."
                    : null
          }
        />
      ) : null}
    </View>
  )
}

function VisitFact({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={16} color={bk.secondary} />
      <Text style={styles.factText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 28 },
  scrollOneTap: { paddingBottom: 150 },
  pad: { paddingHorizontal: 16 },
  lineGap: { gap: 14 },
  ghostRow: { height: 96, borderRadius: 16, backgroundColor: bk.grey },
  waitlist: { marginTop: 12 },
  fact: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  factText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: bk.text },
  bookingFor: { flexDirection: "row", alignItems: "center", gap: 12 },
  bookingForCopy: { flex: 1, minWidth: 0, gap: 2 },
  strong: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: bk.text },
  muted: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: bk.secondary },
  success: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 17, color: bk.green },
  error: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 17, color: bk.red },
  lockedInput: { backgroundColor: "#f3f3f3", color: bk.muted },
  appliedPromo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: bk.greenBg,
  },
  removeText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 17,
    color: bk.red,
    textDecorationLine: "underline",
  },
  promoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  applyBtn: {
    height: 48,
    minWidth: 88,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: bk.text,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnOff: { backgroundColor: bk.disabled },
  applyText: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18, color: "#ffffff" },
  policy: { gap: 2 },
  policyTitle: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18, color: bk.text },
})
