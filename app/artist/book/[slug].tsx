import { Image } from "expo-image"
import { useLocalSearchParams, useNavigation, useRouter, type Href } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ArtistServiceRow } from "@/components/artists/ArtistServiceRow"
import { HomeVisitMapPicker } from "@/components/artists/HomeVisitMapPicker"
import { BookingDateSheet } from "@/components/book/BookingDateSheet"
import { BookingSelectTrigger } from "@/components/book/BookingSelectTrigger"
import { WaitlistPrompt } from "@/components/book/WaitlistPrompt"
import { BookingTimeSheet } from "@/components/book/BookingTimeSheet"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { OneTapPayBar } from "@/components/payments/OneTapPayBar"
import { sp } from "@/components/salon-page/theme"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
import { Screen } from "@/components/ui/Screen"
import { Text } from "@/components/ui/Text"
import {
  artistServiceUnitPrice,
  createArtistBookingWithRewards,
  fetchArtistSlots,
  fetchPublicArtist,
  issueArtistVerificationFromSession,
  type ArtistBookingQuote,
  type ArtistLocationType,
  type PublicArtist,
  type PublicArtistService,
} from "@/lib/artists-api"
import { useCart } from "@/context/CartContext"
import { ApiError } from "@/lib/api"
import { createAdvanceOrder } from "@/lib/advance-payment"
import { artistCartId } from "@/lib/artist-cart"
import { fetchMe } from "@/lib/auth-api"
import {
  canApplyLoyalty,
  EMPTY_LOYALTY_SUMMARY,
  LOYALTY_DISCOUNT_CAP_RUPEES,
  LOYALTY_VISITS_PER_FREE,
  type LoyaltySummary,
} from "@/lib/loyalty"
import { loadProfilePreferApi } from "@/lib/profile-api"
import {
  validateArtistPromoCode,
  type AppliedOfferDiscount,
  type PromoCashbackClaim,
} from "@/lib/promo-api"
import { formatRupees } from "@/lib/service-pricing"
import { getAccessToken } from "@/lib/session"
import {
  getSavedLocation,
  normalizeMobileDigits,
  patchConsumerProfileCache,
} from "@/lib/user"
import { fetchLoyalty, fetchWallet } from "@/lib/wallet-api"
import { colors, radii, shadows, spacing } from "@/theme/tokens"
import { formatDuration } from "@/lib/booking-display"

function dayKeys(from: Date, count: number, timeZone: string) {
  const keys: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000)
    keys.push(d.toLocaleDateString("en-CA", { timeZone }))
  }
  return keys
}

function formatSlot(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatDayChip(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export default function ArtistBookScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const {
    slug,
    serviceId: serviceIdParam,
    serviceIds: serviceIdsParam,
    promo: promoParam,
    leadResponseId: leadResponseParam,
    quoteRupees: quoteRupeesParam,
    leadCategory: leadCategoryParam,
  } = useLocalSearchParams<{
    slug?: string
    serviceId?: string
    serviceIds?: string
    promo?: string
    /** Accepted Get quotes response: book at the artist's quoted price. */
    leadResponseId?: string
    quoteRupees?: string
    leadCategory?: string
  }>()
  const leadResponseId = typeof leadResponseParam === "string" ? leadResponseParam.trim() : ""
  const quotedRupees = Math.round(Number(quoteRupeesParam) || 0)
  const leadCategory = typeof leadCategoryParam === "string" ? leadCategoryParam.trim() : ""
  /** Quote booking: the price is the artist's quote; services only set the duration. */
  const quoteMode = Boolean(leadResponseId) && quotedRupees > 0
  const safeSlug = (slug ?? "").trim().toLowerCase()
  const cart = useCart()
  const initialPromo =
    typeof promoParam === "string" ? promoParam.trim().toUpperCase() : ""

  const [artist, setArtist] = useState<PublicArtist | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [locationType, setLocationType] = useState<ArtistLocationType>("studio")
  const [address, setAddress] = useState("")
  const [landmark, setLandmark] = useState("")
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [date, setDate] = useState("")
  const [slots, setSlots] = useState<string[] | null>(null)
  const [quote, setQuote] = useState<ArtistBookingQuote | null>(null)
  const [slotMessage, setSlotMessage] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [dateSheetOpen, setDateSheetOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [timeSheetOpen, setTimeSheetOpen] = useState(false)
  const [detailService, setDetailService] = useState<PublicArtistService | null>(null)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [verifiedFor, setVerifiedFor] = useState<{ phone: string; token: string } | null>(null)
  const [busy, setBusy] = useState<"book" | "session" | null>(null)
  const paidBooking = useRef<Record<string, string> | null>(null)
  /** Services in the held booking, dropped from the artist's cart once it is paid. */
  const paidServiceIds = useRef<string[]>([])
  const [error, setError] = useState<string | null>(null)
  /** Quote booking held on the server while its advance is paid; amounts come from the server. */
  const [heldQuote, setHeldQuote] = useState<{ token: string; advance: number; payable: number } | null>(null)
  const heldQuotePayable = useRef<number | null>(null)

  const [promoInput, setPromoInput] = useState(initialPromo)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoApplying, setPromoApplying] = useState(false)
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedOfferDiscount | null>(null)
  const [cashbackClaim, setCashbackClaim] = useState<PromoCashbackClaim | null>(null)
  const [useWallet, setUseWallet] = useState(false)
  const [useLoyalty, setUseLoyalty] = useState(false)
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(EMPTY_LOYALTY_SUMMARY)
  const [walletBalance, setWalletBalance] = useState(0)

  const timezone = artist?.timezone || "Asia/Kolkata"
  const days = useMemo(() => dayKeys(new Date(), 14, timezone), [timezone])
  // Until the client picks a date, skip ahead past days with no free times.
  const autoDate = useRef(true)
  const dateOptions = useMemo(
    () => days.map((key) => ({ date: key, label: formatDayChip(key) })),
    [days],
  )
  const timeOptions = useMemo(
    () =>
      (slots ?? []).map((iso) => ({
        value: iso,
        label: formatSlot(iso, timezone),
      })),
    [slots, timezone],
  )
  const selectedSlotLabel = slot
    ? timeOptions.find((option) => option.value === slot)?.label ?? formatSlot(slot, timezone)
    : ""
  const digits = normalizeMobileDigits(phone).slice(-10)
  const phoneValid = /^[6-9]\d{9}$/.test(digits)
  const verified = verifiedFor?.phone === digits ? verifiedFor.token : null

  const loginNext = useMemo(() => {
    const base = `/artist/book/${safeSlug}`
    if (quoteMode) {
      const q = new URLSearchParams({
        leadResponseId,
        quoteRupees: String(quotedRupees),
        ...(leadCategory ? { leadCategory } : {}),
      })
      return `${base}?${q.toString()}`
    }
    const multi =
      typeof serviceIdsParam === "string" ? serviceIdsParam.trim() : ""
    if (multi) return `${base}?serviceIds=${encodeURIComponent(multi)}`
    const sid = typeof serviceIdParam === "string" ? serviceIdParam.trim() : ""
    return sid ? `${base}?serviceId=${encodeURIComponent(sid)}` : base
  }, [safeSlug, serviceIdParam, serviceIdsParam, quoteMode, leadResponseId, quotedRupees, leadCategory])

  useEffect(() => {
    if (!safeSlug) {
      setLoadError("Artist not found.")
      setLoading(false)
      return
    }
    let cancelled = false

    void (async () => {
      const token = await getAccessToken()
      if (cancelled) return
      if (!token) {
        setLoading(false)
        router.replace({
          pathname: "/login",
          params: { next: loginNext },
        })
        return
      }

      const artistLoad = fetchPublicArtist(safeSlug)
        .then((data) => {
          if (cancelled) return
          setArtist(data)
          const fromMulti =
            typeof serviceIdsParam === "string"
              ? serviceIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
              : []
          const fromSingle =
            typeof serviceIdParam === "string" && serviceIdParam.trim()
              ? [serviceIdParam.trim()]
              : []
          const wanted = fromMulti.length > 0 ? fromMulti : fromSingle
          const valid = wanted.filter((id) => data.services.some((s) => s.id === id))
          // Quote booking: one service for the duration, matched to the request's category if possible.
          const quoteMatch = leadCategory
            ? data.services.find((s) => s.category === leadCategory)
            : undefined
          const seed = quoteMode
            ? quoteMatch
              ? [quoteMatch.id]
              : []
            : valid.length > 0
              ? valid
              : data.services[0]
                ? [data.services[0].id]
                : []
          setSelectedIds(seed)
          const seedServices = data.services.filter((s) => seed.includes(s.id))
          const allHome =
            seedServices.length > 0 &&
            seedServices.every((s) => s.locationMode === "client_home")
          setLocationType(allHome ? "client_home" : "studio")
          setDate(
            days[0] ??
              new Date().toLocaleDateString("en-CA", {
                timeZone: data.timezone || "Asia/Kolkata",
              }),
          )
        })
        .catch((err) => {
          if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't load artist.")
        })

      let nextName = ""
      let nextPhone = ""
      try {
        const profile = await loadProfilePreferApi()
        nextName = profile.name.trim()
        nextPhone = normalizeMobileDigits(profile.phone)
      } catch {
        // fall through to /me
      }

      if (!nextPhone || nextPhone.length < 10 || !nextName) {
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
        } catch {
          // keep profile values
        }
      }

      if (!cancelled) {
        if (nextName) setName(nextName)
        if (nextPhone.length >= 10) setPhone(nextPhone)
      }

      try {
        setBusy("session")
        const issued = await issueArtistVerificationFromSession()
        if (!cancelled && issued.verificationToken && issued.phone) {
          const issuedPhone = normalizeMobileDigits(issued.phone).slice(-10)
          setPhone(issuedPhone)
          setVerifiedFor({ phone: issuedPhone, token: issued.verificationToken })
        }
      } catch {
        // Retried on confirm if needed.
      } finally {
        if (!cancelled) setBusy(null)
      }

      await artistLoad
      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
    }
    // days intentionally omitted — only seed on artist load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeSlug, serviceIdParam, serviceIdsParam, loginNext, router])

  useEffect(() => {
    void getSavedLocation().then((loc) => {
      if (!loc) return
      if (loc.formattedAddress || loc.label) setAddress(loc.formattedAddress || loc.label)
      if (loc.latitude != null && loc.longitude != null) {
        setPin({ lat: loc.latitude, lng: loc.longitude })
      }
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getAccessToken()
      if (!token || cancelled) return
      const [loyaltyResult, walletResult] = await Promise.allSettled([
        fetchLoyalty(),
        fetchWallet(),
      ])
      if (cancelled) return
      if (loyaltyResult.status === "fulfilled") setLoyalty(loyaltyResult.value)
      if (walletResult.status === "fulfilled") {
        setWalletBalance(walletResult.value.wallet?.balanceRupees ?? 0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedServices = useMemo(() => {
    if (!artist) return [] as PublicArtistService[]
    return artist.services.filter((s) => selectedIds.includes(s.id))
  }, [artist, selectedIds])

  const locationScope = selectedServices.length > 0 ? selectedServices : artist?.services ?? []
  const serviceAllowsStudio = (s: PublicArtistService) =>
    s.locationMode === "studio" || s.locationMode === "both"
  const serviceAllowsHome = (s: PublicArtistService) =>
    s.locationMode === "client_home" || s.locationMode === "both"

  /** Studio visits: any catalog/selected service that can be done in studio. */
  const canStudio =
    locationScope.length === 0 || locationScope.some(serviceAllowsStudio)
  /**
   * Home visits: artist flag, or any service that allows home.
   * CRM often stores services as `studio` while the profile offers home visits —
   * the public API remaps those to `both` when offersHomeVisits is true.
   */
  const canHome =
    Boolean(artist?.offersHomeVisits) ||
    (locationScope.length > 0 && locationScope.some(serviceAllowsHome))
  const showWhereChooser = canStudio && canHome
  const needsHome = locationType === "client_home"
  const awaitingPin = needsHome && !pin
  const homeIncompatible =
    needsHome &&
    selectedServices.length > 0 &&
    !Boolean(artist?.offersHomeVisits) &&
    selectedServices.some((s) => !serviceAllowsHome(s))
  useEffect(() => {
    if (!artist) return
    if (canStudio && !canHome && locationType !== "studio") setLocationType("studio")
    if (canHome && !canStudio && locationType !== "client_home") {
      setLocationType("client_home")
    }
  }, [artist, canStudio, canHome, locationType])

  function toggleService(service: PublicArtistService) {
    if (quoteMode) {
      setSelectedIds([service.id])
      setSlot(null)
      return
    }
    setSelectedIds((prev) => {
      if (prev.includes(service.id)) {
        if (prev.length === 1) return prev
        return prev.filter((id) => id !== service.id)
      }
      return [...prev, service.id]
    })
    setSlot(null)
  }

  // Slots + quote for the chosen visit location (date/time step).
  useEffect(() => {
    if (!artist || selectedIds.length === 0 || !date || homeIncompatible) {
      setSlots(null)
      setQuote(null)
      setSlotMessage(null)
      return
    }
    const controller = new AbortController()
    setSlotsLoading(true)
    setSlotMessage(null)
    void fetchArtistSlots({
      slug: artist.slug,
      serviceIds: selectedIds,
      date,
      locationType,
      lat: pin?.lat,
      lng: pin?.lng,
      signal: controller.signal,
    })
      .then((data) => {
        if (autoDate.current && data.slots.length === 0) {
          const next = days[days.indexOf(date) + 1]
          if (next) {
            setDate(next)
            return
          }
        }
        setSlots(data.slots)
        setQuote(needsHome && !pin ? null : data.quote)
        setSlotMessage(data.message)
        if (slot && !data.slots.includes(slot)) setSlot(null)
      })
      .catch((err) => {
        if (err?.name === "AbortError") return
        setSlots([])
        setQuote(null)
        setSlotMessage(err instanceof Error ? err.message : "Couldn't load times.")
      })
      .finally(() => setSlotsLoading(false))
    return () => controller.abort()
  }, [
    artist,
    selectedIds,
    date,
    locationType,
    pin?.lat,
    pin?.lng,
    needsHome,
    homeIncompatible,
  ])

  async function ensureVerifiedSession() {
    if (verified && phoneValid) {
      return { token: verified, phone: digits }
    }
    const issued = await issueArtistVerificationFromSession()
    const issuedPhone = normalizeMobileDigits(issued.phone).slice(-10)
    setPhone(issuedPhone)
    setVerifiedFor({ phone: issuedPhone, token: issued.verificationToken })
    return { token: issued.verificationToken, phone: issuedPhone }
  }

  const loyaltyAvailable = canApplyLoyalty(loyalty)
  // Quote booking: the CRM books at the quoted price (no travel fee, no offer codes).
  const quoteTotal = quoteMode ? quotedRupees : quote ? Math.round(quote.total) : 0
  const serviceSubtotal = quoteMode ? quotedRupees : quote ? Math.round(quote.servicePrice) : 0
  const promoDiscount = Math.min(
    Math.max(0, serviceSubtotal),
    Math.max(0, Math.round(appliedDiscount?.discountAmount ?? 0)),
  )
  const loyaltyCredit =
    useLoyalty && loyaltyAvailable
      ? Math.min(LOYALTY_DISCOUNT_CAP_RUPEES, Math.max(serviceSubtotal - promoDiscount, 0))
      : 0
  const amountBeforeWallet = Math.max(0, quoteTotal - promoDiscount - loyaltyCredit)
  const walletCredit = useWallet
    ? Math.min(Math.max(0, Math.round(walletBalance)), amountBeforeWallet)
    : 0
  const payableTotal = Math.max(0, amountBeforeWallet - walletCredit)
  // Advance comes from the artist's quote; never more than what is left to pay.
  // Quote booking: the advance is only known once the server holds the booking.
  const advanceDue = quoteMode
    ? (heldQuote?.advance ?? 0)
    : Math.min(quote?.advance ?? 0, payableTotal)
  const appliedPromoCode = appliedDiscount?.code ?? cashbackClaim?.code ?? null

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase()
    if (!code) {
      setPromoError("Enter a promo code")
      return
    }
    if (!artist || selectedIds.length === 0) {
      setPromoError("Add services before applying a promo code.")
      return
    }
    if (!quote || quoteTotal <= 0) {
      setPromoError("Add services and a time before applying a promo code.")
      return
    }
    setPromoApplying(true)
    setPromoError(null)
    try {
      const result = await validateArtistPromoCode({
        code,
        subtotal: quoteTotal,
        artistSlug: artist.slug,
        serviceIds: selectedIds,
      })
      if (result.kind === "discount") {
        setAppliedDiscount(result.discount)
        setCashbackClaim(null)
        setPromoInput(result.discount.code)
        return
      }
      setAppliedDiscount(null)
      setCashbackClaim(result.cashback)
      setPromoInput(result.cashback.code)
    } catch (err) {
      setAppliedDiscount(null)
      setCashbackClaim(null)
      setPromoError(
        err instanceof ApiError ? err.message : "Could not apply promo code.",
      )
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

  /** Booked services leave the artist's cart; anything else in it stays. */
  function clearBookedFromCart(bookedSlug: string, serviceIds: string[]) {
    const ids = new Set([artistCartId(bookedSlug), safeSlug ? artistCartId(safeSlug) : ""])
    for (const id of ids) if (id) cart.removeServices(id, serviceIds)
  }

  function onAdvancePaid(paidRupees: number) {
    const details = paidBooking.current
    if (!details) return
    clearBookedFromCart(details.salonId, paidServiceIds.current)
    router.replace({
      pathname: "/book/confirmation",
      params: { ...details, status: "confirmed", advancePaid: String(paidRupees) },
    } as Href)
  }

  async function onBook() {
    if (!artist || selectedIds.length === 0 || !slot) return
    if (name.trim().length < 2) {
      setError("Add your name in Profile before booking.")
      return
    }
    if (needsHome && (!address.trim() || !pin)) {
      setError("Add your address and location for a home visit.")
      return
    }
    setError(null)
    // An advance is due: the one-tap pay bar books and pays in one go.
    if (advanceDue > 0 || heldQuote) return
    // Quote booking already held, but its advance didn't load: only retry that.
    const heldToken = paidBooking.current?.payToken
    if (quoteMode && heldToken) {
      setBusy("book")
      await loadHeldQuoteAdvance(heldToken)
      setBusy(null)
      return
    }
    void createBooking()
  }

  /** Quote booking: what the server will charge for the held booking's advance. */
  async function loadHeldQuoteAdvance(token: string) {
    try {
      const order = await createAdvanceOrder(token)
      setHeldQuote({
        token,
        advance: Math.round(order.amountPaise / 100),
        payable: heldQuotePayable.current ?? quotedRupees,
      })
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `${err.message} Tap Confirm to try again.`
          : "Couldn't load the advance. Tap Confirm to try again.",
      )
    }
  }

  /** Creates the booking. Returns its token while the advance is still due, otherwise null. */
  async function createBooking(): Promise<string | null> {
    if (!artist || !slot) return null
    setBusy("book")
    setError(null)
    try {
      // Keep session warm for CRM; booking itself goes through Glammzo-web for rewards.
      await ensureVerifiedSession()
      const bookedIds = [...selectedIds]
      const res = await createArtistBookingWithRewards({
        slug: artist.slug,
        serviceIds: bookedIds,
        startAt: slot,
        locationType,
        address: address.trim(),
        landmark: landmark.trim() || null,
        lat: pin?.lat,
        lng: pin?.lng,
        fullName: name.trim(),
        promoCode: quoteMode ? undefined : appliedPromoCode || undefined,
        useWallet: useWallet && walletBalance > 0,
        useFreeService: useLoyalty && loyaltyAvailable,
        leadResponseId: quoteMode ? leadResponseId : undefined,
      })
      const dateKey = new Date(res.booking.startsAt).toLocaleDateString("en-CA", {
        timeZone: timezone,
      })
      const confirmation = {
        kind: "artist",
        salonId: artist.slug,
        bookingId: `artist:${res.booking.token}`,
        total: String(Math.round(res.payable ?? payableTotal)),
        slot: formatSlot(res.booking.startsAt, timezone),
        name: name.trim(),
        date: dateKey,
        services: selectedServices.map((s) => s.name).join(" · "),
        visitType: locationType === "client_home" ? "Home visit" : "Studio visit",
        area: [artist.area, artist.city].filter(Boolean).join(", "),
        providerName: artist.displayName,
        photoUrl: artist.profilePhotoUrl ?? "",
      }
      // The artist asks for an advance: the open sheet takes it from here.
      if (res.awaitingPayment) {
        paidBooking.current = { ...confirmation, payToken: res.booking.token }
        paidServiceIds.current = bookedIds
        if (quoteMode) {
          heldQuotePayable.current = Math.round(res.payable ?? quotedRupees)
          await loadHeldQuoteAdvance(res.booking.token)
        }
        return res.booking.token
      }
      clearBookedFromCart(artist.slug, bookedIds)
      router.replace({
        pathname: "/book/confirmation",
        params: { ...confirmation, status: "confirmed" },
      } as Href)
      return null
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Couldn't book."
      setError(message)
      if (/no longer available/i.test(message)) setSlot(null)
      return null
    } finally {
      setBusy(null)
    }
  }

  // Keep an applied artist offer in sync when the bag changes.
  useEffect(() => {
    if (!artist || !appliedDiscount) return
    if (selectedIds.length === 0) {
      setAppliedDiscount(null)
      return
    }
    let active = true
    void validateArtistPromoCode({
      code: appliedDiscount.code,
      subtotal: Math.max(quoteTotal, serviceSubtotal, 1),
      artistSlug: artist.slug,
      serviceIds: selectedIds,
    })
      .then((result) => {
        if (!active) return
        if (result.kind === "discount") {
          setAppliedDiscount(result.discount)
          setPromoError(null)
          return
        }
        setAppliedDiscount(null)
      })
      .catch(() => {
        if (active) setAppliedDiscount(null)
      })
    return () => {
      active = false
    }
  }, [artist?.slug, selectedIds.join("|")])

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (step > 0) setStep((prev) => prev - 1)
            else if (router.canGoBack()) router.back()
            else router.replace("/(tabs)/explore" as Href)
          }}
          hitSlop={8}
          accessibilityLabel="Go back"
          style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
        >
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ),
    })
  }, [navigation, router, step])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (loadError || !artist) {
    return (
      <View style={styles.center}>
        <Text variant="heading">Couldn't start booking</Text>
        <Text variant="body" muted>
          {loadError ?? "Artist not found."}
        </Text>
        <Button label="Go back" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    )
  }

  const canBook =
    Boolean(selectedIds.length > 0 && slot && name.trim().length >= 2) &&
    !homeIncompatible &&
    quote != null &&
    (!needsHome || (address.trim().length >= 5 && pin != null))

  const stepReady = {
    services: selectedIds.length > 0,
    details:
      Boolean(date && slot) &&
      !homeIncompatible &&
      quote != null &&
      (!needsHome || (address.trim().length >= 5 && pin != null)),
  }

  const whereLine = [artist.area, artist.city].filter(Boolean).join(", ")
  const servicesSubtotal = selectedServices.reduce(
    (sum, s) => sum + artistServiceUnitPrice(s, "studio"),
    0,
  )
  const visitWhereLabel =
    locationType === "client_home"
      ? "Artist comes to your home"
      : "At the artist's studio"
  const travelFee = quoteMode ? 0 : quote?.travelFee ?? 0
  const totalDue = heldQuote ? heldQuote.payable : payableTotal
  // One price in the bottom bar; the full breakdown lives on the review step.
  const barPrice = quoteMode
    ? formatRupees(quotedRupees)
    : quote != null
      ? formatRupees(quote.total)
      : `${needsHome ? "From " : ""}${formatRupees(servicesSubtotal)}`
  const barNote = quoteMode
    ? "Your quoted price"
    : awaitingPin
    ? "Add location for final price"
    : quote && quote.advance > 0
      ? `${formatRupees(quote.advance)} advance now`
      : "Pay at your visit"

  return (
    <View style={styles.root}>
      <Screen
        scroll
        contentStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        edges={["left", "right"]}
      >
        <Text variant="title">Reserve your visit</Text>
        <Text muted style={styles.gap}>
          {step === 0
            ? "Step 1 of 3 · Your services"
            : step === 1
              ? "Step 2 of 3 · When and where"
              : "Step 3 of 3 · Review and confirm"}
        </Text>

        {quoteMode ? (
          <View style={styles.quoteBanner} accessibilityRole="summary">
            <Icon name="pricetag-outline" size={18} color={sp.peachInk} />
            <Text variant="bodyStrong" color={sp.peachInk} style={styles.quoteBannerText}>
              Booking at your quoted price {formatRupees(quotedRupees)}
            </Text>
          </View>
        ) : null}

        {step === 0 ? (
          <>
            <View style={styles.card}>
              <View style={styles.artistRow}>
                {artist.profilePhotoUrl ? (
                  <Image
                    source={{ uri: artist.profilePhotoUrl }}
                    style={styles.artistAvatar}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={[styles.artistAvatar, styles.artistAvatarFallback]}>
                    <Text variant="heading" color={colors.primary}>
                      {artist.displayName.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.artistCopy}>
                  <Text variant="label" muted>
                    Solo artist
                  </Text>
                  <Text variant="heading" numberOfLines={1}>
                    {artist.displayName}
                  </Text>
                  {whereLine ? (
                    <Text muted numberOfLines={1}>
                      {whereLine}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text variant="label" muted>
                  {quoteMode ? "Pick a service" : "Services"}
                </Text>
                {quoteMode ? null : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/artist/[slug]",
                      params: { slug: artist.slug },
                    } as Href)
                  }
                >
                  <Text variant="caption" color={colors.primary}>
                    Edit
                  </Text>
                </Pressable>
                )}
              </View>
              {quoteMode ? (
                <Text variant="caption" muted>
                  {selectedIds.length === 0
                    ? "Pick the service closest to what you asked for. It sets how long the visit takes; you pay the quoted price."
                    : "This sets how long the visit takes. You pay the quoted price, not the list price."}
                </Text>
              ) : null}
              <View style={styles.serviceList}>
                {(quoteMode ? artist.services : selectedServices).map((s, index, list) => (
                  <ArtistServiceRow
                    key={s.id}
                    service={s}
                    selected={selectedIds.includes(s.id)}
                    isLast={index === list.length - 1}
                    pricingLocation="studio"
                    onOpenDetail={() => setDetailService(s)}
                    onToggle={() => toggleService(s)}
                  />
                ))}
              </View>
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <View style={styles.section}>
              <Text variant="heading">Where is the visit?</Text>
              {showWhereChooser ? (
                <View style={styles.whereChoices}>
                  <Pressable
                    onPress={() => {
                      setLocationType("studio")
                      setSlot(null)
                    }}
                    style={[
                      styles.whereCard,
                      locationType === "studio" && styles.whereCardOn,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: locationType === "studio" }}
                  >
                    <Icon
                      name="storefront-outline"
                      size={22}
                      color={locationType === "studio" ? colors.primary : colors.textMuted}
                    />
                    <Text variant="bodyStrong" style={styles.whereCardTitle}>
                      Artist&apos;s studio
                    </Text>
                    <Text variant="caption" muted style={styles.whereCardSub}>
                      You visit them
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setLocationType("client_home")
                      setSlot(null)
                    }}
                    style={[
                      styles.whereCard,
                      locationType === "client_home" && styles.whereCardOn,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: locationType === "client_home" }}
                  >
                    <Icon
                      name="home-outline"
                      size={22}
                      color={
                        locationType === "client_home" ? colors.primary : colors.textMuted
                      }
                    />
                    <Text variant="bodyStrong" style={styles.whereCardTitle}>
                      Your home
                    </Text>
                    <Text variant="caption" muted style={styles.whereCardSub}>
                      They come to you
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.card}>
                  <Text variant="bodyStrong">{visitWhereLabel}</Text>
                  <Text variant="caption" muted style={{ marginTop: 4 }}>
                    {canHome && !canStudio
                      ? "This artist only offers home visits for these services."
                      : "This artist only offers studio visits for these services."}
                  </Text>
                </View>
              )}
              {homeIncompatible ? (
                <Text variant="caption" color={colors.destructive}>
                  One or more selected services are studio-only. Switch back to the
                  artist&apos;s studio, or remove those services.
                </Text>
              ) : null}
            </View>

            {needsHome ? (
              <View style={styles.section}>
                <Text variant="heading">Your address</Text>
                <HomeVisitMapPicker
                  latitude={pin?.lat}
                  longitude={pin?.lng}
                  address={address}
                  onChange={(next) => {
                    setPin({ lat: next.lat, lng: next.lng })
                    if (next.address.trim()) setAddress(next.address.trim())
                    setSlot(null)
                  }}
                />
                <Input
                  label="Full address"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="House / street / area"
                />
                <Input
                  label="Landmark (optional)"
                  value={landmark}
                  onChangeText={setLandmark}
                  placeholder="Near…"
                />
                {travelFee > 0 ? (
                  <Text variant="caption" muted>
                    Travel fee {formatRupees(travelFee)}
                    {quote?.distanceKm != null ? ` · ${quote.distanceKm.toFixed(1)} km` : ""}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text variant="heading">Date & time</Text>
              <BookingSelectTrigger
                label="Date"
                icon="calendar-outline"
                value={date ? formatDayChip(date) : ""}
                placeholder="Select date"
                disabled={dateOptions.length === 0 || homeIncompatible}
                onPress={() => setDateSheetOpen(true)}
              />
              <BookingSelectTrigger
                label="Time"
                icon="time-outline"
                value={selectedSlotLabel}
                placeholder={
                  homeIncompatible
                    ? "Choose a valid visit location first"
                    : !date
                      ? "Pick a date first"
                      : slotsLoading
                        ? "Loading available times…"
                        : slotMessage
                          ? slotMessage
                          : timeOptions.length === 0
                            ? "No times available"
                            : "Select time"
                }
                disabled={
                  homeIncompatible ||
                  !date ||
                  slotsLoading ||
                  Boolean(slotMessage) ||
                  timeOptions.length === 0
                }
                onPress={() => setTimeSheetOpen(true)}
              />
              {date && !slotsLoading && !homeIncompatible && !slotMessage && timeOptions.length === 0 ? (
                <WaitlistPrompt kind="artist" provider={artist.slug} date={date} serviceIds={selectedIds} />
              ) : null}
            </View>

          </>
        ) : null}

        {step === 2 ? (
          <View style={styles.section}>
            <Text variant="heading">Confirm booking</Text>
            <View style={styles.card}>
              <Text variant="caption" muted>
                Artist
              </Text>
              <Text variant="heading">{artist.displayName}</Text>
              <Text variant="caption" muted style={{ marginTop: spacing.sm }}>
                Services
              </Text>
              <Text variant="bodyStrong">
                {selectedServices.map((s) => s.name).join(" · ")}
              </Text>
              <Text variant="caption" muted style={{ marginTop: spacing.sm }}>
                When
              </Text>
              <Text variant="bodyStrong">
                {date ? formatDayChip(date) : "—"}
                {selectedSlotLabel ? ` · ${selectedSlotLabel}` : ""}
              </Text>
              <Text variant="caption" muted style={{ marginTop: spacing.sm }}>
                Where
              </Text>
              <Text variant="bodyStrong">
                {visitWhereLabel}
                {needsHome && address.trim() ? ` · ${address.trim()}` : ""}
              </Text>
            </View>

            {quoteMode ? null : (
            <View style={[styles.card, styles.rewardsCard]}>
              <Text variant="label" muted>
                Promo code
              </Text>
              {appliedPromoCode ? (
                <View style={styles.appliedPromo}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{appliedPromoCode}</Text>
                    {appliedDiscount ? (
                      <Text variant="caption" muted>
                        {appliedDiscount.title} · save{" "}
                        {formatRupees(appliedDiscount.discountAmount)}
                      </Text>
                    ) : null}
                    {cashbackClaim ? (
                      <Text variant="caption" muted>
                        ₹{cashbackClaim.cashbackRupees} wallet cashback after visit
                      </Text>
                    ) : null}
                  </View>
                  <Pressable accessibilityRole="button" onPress={clearPromo} hitSlop={8}>
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
              ) : appliedDiscount && !promoError ? (
                <Text variant="caption" muted>
                  Artist offer applied on service price.
                </Text>
              ) : (
                <Text variant="caption" muted>
                  Artist offer codes and Glammzo cashback codes work here.
                </Text>
              )}
            </View>
            )}

            <View style={[styles.card, styles.rewardsCard]}>
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
                  !loyaltyAvailable && styles.rewardDisabled,
                ]}
                disabled={!loyaltyAvailable}
                onPress={() => {
                  if (!loyaltyAvailable) return
                  setUseLoyalty((value) => !value)
                }}
              >
                <View style={styles.rewardIcon}>
                  <Icon name="ribbon-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.rewardCopy}>
                  <Text variant="bodyStrong">Loyalty reward</Text>
                  <Text variant="caption" muted>
                    {loyaltyAvailable
                      ? `Up to ₹${LOYALTY_DISCOUNT_CAP_RUPEES} off · ${loyalty.freeServiceCredits} credit${loyalty.freeServiceCredits === 1 ? "" : "s"} · tap to ${useLoyalty ? "remove" : "apply"}`
                      : `Complete ${LOYALTY_VISITS_PER_FREE} services → unlock up to ₹${LOYALTY_DISCOUNT_CAP_RUPEES} off. ${loyalty.stampsTowardNextFree}/${LOYALTY_VISITS_PER_FREE} completed · ${loyalty.visitsLeft} more to go.`}
                  </Text>
                </View>
                <View
                  style={[
                    styles.applyChip,
                    useLoyalty && loyaltyAvailable && styles.applyChipOn,
                    !loyaltyAvailable && styles.applyChipDisabled,
                  ]}
                >
                  <Text
                    variant="caption"
                    color={
                      !loyaltyAvailable
                        ? colors.textSubtle
                        : useLoyalty
                          ? colors.primaryFg
                          : colors.primary
                    }
                  >
                    {!loyaltyAvailable ? "Locked" : useLoyalty ? "Applied" : "Apply"}
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={[styles.card, styles.rewardsCard]}>
              <Text variant="label" muted>
                Payment summary
              </Text>
              <View style={styles.summaryRow}>
                <Text muted>
                  {quoteMode ? "Quoted price" : "Services"}
                  {needsHome && !quoteMode ? " (home rates)" : ""}
                </Text>
                <Text>{formatRupees(serviceSubtotal)}</Text>
              </View>
              {travelFee > 0 ? (
                <View style={styles.summaryRow}>
                  <Text muted>
                    Travel fee
                    {quote?.distanceKm != null
                      ? ` · ${quote.distanceKm.toFixed(1)} km`
                      : ""}
                  </Text>
                  <Text>{formatRupees(travelFee)}</Text>
                </View>
              ) : null}
              {promoDiscount > 0 && appliedDiscount ? (
                <View style={styles.summaryRow}>
                  <Text muted>Offer ({appliedDiscount.code})</Text>
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
                  <Text color={colors.success}>−{formatRupees(loyaltyCredit)}</Text>
                </View>
              ) : null}
              {walletCredit > 0 ? (
                <View style={styles.summaryRow}>
                  <Text muted>Wallet</Text>
                  <Text color={colors.success}>−{formatRupees(walletCredit)}</Text>
                </View>
              ) : null}
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text variant="bodyStrong">Total</Text>
                <Text variant="heading">{formatRupees(totalDue)}</Text>
              </View>
              {advanceDue > 0 ? (
                <>
                  <View style={styles.summaryRow}>
                    <Text variant="bodyStrong">Pay now (advance)</Text>
                    <Text variant="bodyStrong">{formatRupees(advanceDue)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text muted>Pay the artist at your visit</Text>
                    <Text muted>{formatRupees(Math.max(0, totalDue - advanceDue))}</Text>
                  </View>
                  <Text variant="caption" muted>
                    Your time is held for 15 minutes while you pay.
                  </Text>
                </>
              ) : quoteMode ? (
                <Text variant="caption" muted>
                  Pay the artist at your visit. If this artist takes an advance, you&apos;ll see it after you
                  confirm.
                </Text>
              ) : (
                <Text variant="caption" muted>
                  Pay the artist at your visit.
                </Text>
              )}
            </View>

            {advanceDue > 0 && artist.cancellationPolicyLines?.length ? (
              <View style={styles.policyCard}>
                <Text variant="label">If you cancel</Text>
                {artist.cancellationPolicyLines.map((line) => (
                  <Text key={line} variant="caption" muted>{`• ${line}`}</Text>
                ))}
              </View>
            ) : null}

            {artist.cancellationPolicyText ? (
              <View style={styles.policyCard}>
                <Text variant="caption" muted>
                  {artist.cancellationPolicyText}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {error ? (
          <Text variant="caption" color={colors.destructive}>
            {error}
          </Text>
        ) : null}
      </Screen>

      {step === 2 && advanceDue > 0 ? (
        <OneTapPayBar
          amountRupees={advanceDue}
          reserve={quoteMode ? async () => heldQuote?.token ?? null : createBooking}
          onPaid={onAdvancePaid}
          error={error}
          disabledReason={
            busy === "session"
              ? "Getting your booking ready…"
              : canBook
                ? null
                : name.trim().length < 2
                  ? "Add your name in Profile before booking."
                  : needsHome && (address.trim().length < 5 || !pin)
                    ? "Add your address and location for a home visit."
                    : "Finish the steps above to book."
          }
        />
      ) : (
        <View
          style={[
            styles.ctaBar,
            step < 2 && styles.ctaBarRow,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          {step < 2 ? (
            <View
              style={styles.ctaPrice}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={`Total ${barPrice}. ${barNote}.`}
            >
              <Text variant="heading" numberOfLines={1}>
                {barPrice}
              </Text>
              <Text variant="caption" muted numberOfLines={1}>
                {barNote}
              </Text>
            </View>
          ) : null}
          <Button
            style={step < 2 ? styles.ctaButton : undefined}
            label={
              busy === "book"
                ? "Booking…"
                : step === 0
                  ? "Continue"
                  : step === 1
                    ? "Continue"
                    : advanceDue > 0
                      ? `Continue to pay ${formatRupees(advanceDue)}`
                      : quote
                        ? `Confirm · ${formatRupees(totalDue)}`
                        : "Confirm booking"
            }
            loading={busy === "book" || busy === "session"}
            disabled={
              busy === "book" ||
              busy === "session" ||
              (step === 0 && !stepReady.services) ||
              (step === 1 && !stepReady.details) ||
              (step === 2 && !canBook)
            }
            onPress={() => {
              if (step === 0) {
                if (stepReady.services) setStep(1)
                return
              }
              if (step === 1) {
                if (stepReady.details) setStep(2)
                return
              }
              void onBook()
            }}
          />
        </View>
      )}


      <BookingDateSheet
        visible={dateSheetOpen}
        options={dateOptions}
        value={date || null}
        onClose={() => setDateSheetOpen(false)}
        onSelect={(next) => {
          autoDate.current = false
          setDate(next)
          setSlot(null)
        }}
      />
      <BookingTimeSheet
        visible={timeSheetOpen}
        options={timeOptions}
        value={slot}
        emptyMessage={slotMessage || "No time slots for this day."}
        onClose={() => setTimeSheetOpen(false)}
        onSelect={setSlot}
        onClear={() => setSlot(null)}
      />

      <BottomSheet
        visible={detailService != null}
        title="Service summary"
        onClose={() => setDetailService(null)}
      >
        {detailService ? (
          <View style={{ gap: spacing.xs, paddingBottom: spacing.md }}>
            <Text variant="heading">{detailService.name}</Text>
            <Text muted style={{ marginTop: spacing.xs }}>
              {formatDuration(detailService.durationMinutes)} ·{" "}
              {formatRupees(artistServiceUnitPrice(detailService, "studio"))} at
              studio
            </Text>
            {detailService.homeVisitPriceOverride != null ? (
              <Text variant="caption" muted>
                {formatRupees(detailService.homeVisitPriceOverride)} if artist
                comes to your home
              </Text>
            ) : null}
            {detailService.description ? (
              <Text variant="body" muted style={{ marginTop: spacing.lg }}>
                {detailService.description}
              </Text>
            ) : null}
            <Button
              label={
                selectedIds.includes(detailService.id) ? "Remove from bag" : "Add to bag"
              }
              variant={selectedIds.includes(detailService.id) ? "secondary" : "primary"}
              style={{ marginTop: spacing.xxl }}
              onPress={() => {
                toggleService(detailService)
                setDetailService(null)
              }}
            />
          </View>
        ) : null}
      </BottomSheet>

    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingBottom: 130,
    gap: spacing.lg,
  },
  gap: {
    marginTop: spacing.sm,
  },
  section: { gap: spacing.md },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  serviceList: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: "hidden",
    ...shadows.card,
  },
  whereChoices: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  whereCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    minHeight: 104,
  },
  whereCardOn: {
    borderColor: colors.primary,
    backgroundColor: "#F1F1F1",
  },
  whereCardTitle: { textAlign: "center" },
  whereCardSub: { textAlign: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  policyCard: {
    backgroundColor: colors.muted,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  artistRow: {
    flexDirection: "row",
    gap: spacing.lg,
    alignItems: "center",
  },
  artistAvatar: {
    width: 84,
    height: 84,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
  },
  artistAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  artistCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  ctaBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  ctaPrice: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ctaButton: {
    flex: 1,
  },
  rewardsCard: {
    gap: spacing.md,
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
  quoteBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: sp.peachBg,
  },
  quoteBannerText: {
    flex: 1,
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
