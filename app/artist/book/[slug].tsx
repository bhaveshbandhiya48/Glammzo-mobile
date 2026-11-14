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

import { ArtistServiceRow } from "@/components/artist-page/ArtistServiceRow"
import { HomeVisitMapPicker } from "@/components/artists/HomeVisitMapPicker"
import {
  bk,
  BookingBar,
  BookingCard,
  BookingHeader,
  BookingSectionLabel,
  BookingSkeleton,
  bookingStyles,
  DayStrip,
  Hairline,
  Notice,
  PlaceRow,
  ReceiptRow,
  ReceiptTotal,
  TimeGrid,
  ToggleRow,
} from "@/components/book/BookingUi"
import { WaitlistPrompt } from "@/components/book/WaitlistPrompt"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { OneTapPayBar } from "@/components/payments/OneTapPayBar"
import { PastelIcon, type Pastel } from "@/components/profile/ProfileParts"
import {
  EmptyState,
  ErrorCard,
  Field,
  OutlinePill,
  PrimaryPill,
} from "@/components/profile/ProfileScreenParts"
import { pastels, ui } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
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
import { fontFamily } from "@/theme/tokens"
import { formatDuration } from "@/lib/booking-display"

const STEPS = ["Services", "When & where", "Confirm"]

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

  function leaveScreen() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/explore" as Href)
  }

  /** Header back: previous step first, then leave the screen. */
  function goBack() {
    if (step > 0) setStep((prev) => prev - 1)
    else leaveScreen()
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingSkeleton />
      </>
    )
  }

  if (loadError || !artist) {
    return (
      <View style={bookingStyles.page}>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingHeader title="Book your visit" onBack={leaveScreen} />
        <View style={styles.pad}>
          <ErrorCard
            title="Couldn't start booking"
            text={loadError ?? "Artist not found."}
            onRetry={() => router.back()}
          />
        </View>
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
  const showOneTap = step === 2 && advanceDue > 0
  const serviceRows = quoteMode ? artist.services : selectedServices

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
            subtitle={artist.displayName}
            step={step}
            steps={STEPS}
            onBack={goBack}
            backLabel={step > 0 ? `Back to ${STEPS[step - 1]}` : "Go back"}
          />

          {quoteMode ? (
            <View style={[styles.pad, styles.quoteWrap]}>
              <Notice tone="peach" icon="pricetag-outline">
                Booking at your quoted price {formatRupees(quotedRupees)}
              </Notice>
            </View>
          ) : null}

          {step === 0 ? (
            <View style={styles.pad}>
              <BookingSectionLabel first>Your artist</BookingSectionLabel>
              <BookingCard>
                <PlaceRow
                  imageUrl={artist.profilePhotoUrl}
                  name={artist.displayName}
                  caption="Solo artist"
                  meta={whereLine || null}
                />
              </BookingCard>

              <BookingSectionLabel
                action={
                  quoteMode
                    ? undefined
                    : {
                        label: "Edit",
                        onPress: () =>
                          router.push({
                            pathname: "/artist/[slug]",
                            params: { slug: artist.slug },
                          } as Href),
                      }
                }
              >
                {quoteMode ? "Pick a service" : "Your services"}
              </BookingSectionLabel>
              {quoteMode ? (
                <Text style={styles.helper}>
                  {selectedIds.length === 0
                    ? "Pick the service closest to what you asked for. It sets how long the visit takes; you pay the quoted price."
                    : "This sets how long the visit takes. You pay the quoted price, not the list price."}
                </Text>
              ) : null}
              {serviceRows.length > 0 ? (
                <View style={styles.serviceList}>
                  {serviceRows.map((s, index, list) => (
                    <ArtistServiceRow
                      key={s.id}
                      service={s}
                      selected={selectedIds.includes(s.id)}
                      isLast={index === list.length - 1}
                      onOpenDetail={() => setDetailService(s)}
                      onToggle={() => toggleService(s)}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState
                  pastel={pastels.pink}
                  icon="bag-handle-outline"
                  title="No services yet"
                  text="Add services on the artist's page to continue."
                  ctaLabel="Browse services"
                  onCta={() =>
                    router.push({ pathname: "/artist/[slug]", params: { slug: artist.slug } } as Href)
                  }
                />
              )}
            </View>
          ) : null}

          {step === 1 ? (
            <>
              <View style={styles.pad}>
                <BookingSectionLabel first>Where is the visit?</BookingSectionLabel>
                {showWhereChooser ? (
                  <View style={styles.whereChoices} accessibilityRole="radiogroup">
                    <WhereCard
                      icon="storefront-outline"
                      pastel={pastels.peach}
                      title="Artist's studio"
                      caption="You visit them"
                      active={locationType === "studio"}
                      onPress={() => {
                        setLocationType("studio")
                        setSlot(null)
                      }}
                    />
                    <WhereCard
                      icon="home-outline"
                      pastel={pastels.sky}
                      title="Your home"
                      caption="They come to you"
                      active={locationType === "client_home"}
                      onPress={() => {
                        setLocationType("client_home")
                        setSlot(null)
                      }}
                    />
                  </View>
                ) : (
                  <BookingCard>
                    <View style={styles.factRow}>
                      <PastelIcon
                        pastel={locationType === "client_home" ? pastels.sky : pastels.peach}
                        name={locationType === "client_home" ? "home-outline" : "storefront-outline"}
                      />
                      <View style={styles.flexCopy}>
                        <Text style={styles.strong}>{visitWhereLabel}</Text>
                        <Text style={styles.muted}>
                          {canHome && !canStudio
                            ? "This artist only offers home visits for these services."
                            : "This artist only offers studio visits for these services."}
                        </Text>
                      </View>
                    </View>
                  </BookingCard>
                )}
                {homeIncompatible ? (
                  <View style={styles.noticeGap}>
                    <Notice tone="red" icon="alert-circle-outline">
                      One or more selected services are studio-only. Switch back to the
                      artist&apos;s studio, or remove those services.
                    </Notice>
                  </View>
                ) : null}

                {needsHome ? (
                  <>
                    <BookingSectionLabel>Your address</BookingSectionLabel>
                    <BookingCard>
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
                      <Field
                        label="Full address"
                        value={address}
                        onChangeText={setAddress}
                        placeholder="House / street / area"
                      />
                      <Field
                        label="Landmark (optional)"
                        value={landmark}
                        onChangeText={setLandmark}
                        placeholder="Near…"
                      />
                      {travelFee > 0 ? (
                        <Notice tone="grey" icon="car-outline">
                          Travel fee {formatRupees(travelFee)}
                          {quote?.distanceKm != null ? ` · ${quote.distanceKm.toFixed(1)} km` : ""}
                        </Notice>
                      ) : null}
                    </BookingCard>
                  </>
                ) : null}

                <BookingSectionLabel>Pick a day</BookingSectionLabel>
              </View>
              {homeIncompatible ? (
                <View style={styles.pad}>
                  <Notice tone="grey">Choose a valid visit location first.</Notice>
                </View>
              ) : dateOptions.length === 0 ? (
                <View style={styles.pad}>
                  <Notice tone="grey">No dates available for this booking yet.</Notice>
                </View>
              ) : (
                <DayStrip
                  options={dateOptions}
                  value={date || null}
                  onSelect={(next) => {
                    autoDate.current = false
                    setDate(next)
                    setSlot(null)
                  }}
                />
              )}

              <View style={styles.pad}>
                <BookingSectionLabel>Pick a time</BookingSectionLabel>
                {homeIncompatible ? (
                  <Notice tone="grey">Choose a valid visit location first.</Notice>
                ) : !date ? (
                  <Notice tone="grey">Pick a day first.</Notice>
                ) : slotMessage && !slotsLoading ? (
                  <Notice tone="peach" icon="time-outline">
                    {slotMessage}
                  </Notice>
                ) : (
                  <TimeGrid
                    options={timeOptions}
                    value={slot}
                    onSelect={setSlot}
                    loading={slotsLoading}
                    emptyMessage="No time slots for this day."
                  />
                )}
                {date && !slotsLoading && !homeIncompatible && !slotMessage && timeOptions.length === 0 ? (
                  <View style={styles.noticeGap}>
                    <WaitlistPrompt kind="artist" provider={artist.slug} date={date} serviceIds={selectedIds} />
                  </View>
                ) : null}
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
                  imageUrl={artist.profilePhotoUrl}
                  name={artist.displayName}
                  caption={whereLine || "Solo artist"}
                />
                <Hairline />
                <VisitFact icon="sparkles-outline" text={selectedServices.map((s) => s.name).join(" · ") || "Services"} />
                <VisitFact
                  icon="calendar-outline"
                  text={`${date ? formatDayChip(date) : "—"}${selectedSlotLabel ? ` · ${selectedSlotLabel}` : ""}`}
                />
                <VisitFact
                  icon={locationType === "client_home" ? "home-outline" : "storefront-outline"}
                  text={`${visitWhereLabel}${needsHome && address.trim() ? ` · ${address.trim()}` : ""}`}
                />
              </BookingCard>

              <BookingSectionLabel>{quoteMode ? "Wallet & rewards" : "Offers"}</BookingSectionLabel>
              <BookingCard>
                {quoteMode ? null : (
                  <>
                    {appliedPromoCode ? (
                      <View style={styles.appliedPromo}>
                        <PastelIcon pastel={pastels.mint} name="pricetag-outline" />
                        <View style={styles.flexCopy}>
                          <Text style={styles.strong}>{appliedPromoCode}</Text>
                          {appliedDiscount ? (
                            <Text style={styles.success}>
                              {appliedDiscount.title} · save {formatRupees(appliedDiscount.discountAmount)}
                            </Text>
                          ) : null}
                          {cashbackClaim ? (
                            <Text style={styles.success}>
                              ₹{cashbackClaim.cashbackRupees} wallet cashback after visit
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
                    {promoError ? (
                      <Text style={styles.error}>{promoError}</Text>
                    ) : null}
                    {cashbackClaim && !promoError ? (
                      <Text style={styles.muted}>{cashbackClaim.message}</Text>
                    ) : appliedDiscount && !promoError ? (
                      <Text style={styles.muted}>Artist offer applied on service price.</Text>
                    ) : (
                      <Text style={styles.muted}>
                        Artist offer codes and Glammzo cashback codes work here.
                      </Text>
                    )}
                    <Hairline />
                  </>
                )}
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
                    loyaltyAvailable
                      ? `Up to ₹${LOYALTY_DISCOUNT_CAP_RUPEES} off · ${loyalty.freeServiceCredits} credit${loyalty.freeServiceCredits === 1 ? "" : "s"}`
                      : `Complete ${LOYALTY_VISITS_PER_FREE} services → unlock up to ₹${LOYALTY_DISCOUNT_CAP_RUPEES} off. ${loyalty.stampsTowardNextFree}/${LOYALTY_VISITS_PER_FREE} completed · ${loyalty.visitsLeft} more to go.`
                  }
                  on={useLoyalty && loyaltyAvailable}
                  disabled={!loyaltyAvailable}
                  badge={!loyaltyAvailable ? "Locked" : null}
                  onPress={() => {
                    if (!loyaltyAvailable) return
                    setUseLoyalty((value) => !value)
                  }}
                />
              </BookingCard>

              <BookingSectionLabel>Bill summary</BookingSectionLabel>
              <BookingCard>
                <ReceiptRow
                  label={`${quoteMode ? "Quoted price" : "Services"}${needsHome && !quoteMode ? " (home rates)" : ""}`}
                  value={formatRupees(serviceSubtotal)}
                />
                {travelFee > 0 ? (
                  <ReceiptRow
                    label={`Travel fee${quote?.distanceKm != null ? ` · ${quote.distanceKm.toFixed(1)} km` : ""}`}
                    value={formatRupees(travelFee)}
                  />
                ) : null}
                {promoDiscount > 0 && appliedDiscount ? (
                  <ReceiptRow
                    label={`Offer (${appliedDiscount.code})`}
                    value={`−${formatRupees(promoDiscount)}`}
                    tone="success"
                  />
                ) : null}
                {cashbackClaim ? (
                  <ReceiptRow
                    label={`Cashback (${cashbackClaim.code})`}
                    value={`+₹${cashbackClaim.cashbackRupees} later`}
                    tone="muted"
                  />
                ) : null}
                {loyaltyCredit > 0 ? (
                  <ReceiptRow label="Loyalty" value={`−${formatRupees(loyaltyCredit)}`} tone="success" />
                ) : null}
                {walletCredit > 0 ? (
                  <ReceiptRow label="Wallet" value={`−${formatRupees(walletCredit)}`} tone="success" />
                ) : null}
                <ReceiptTotal
                  label="Total"
                  value={formatRupees(totalDue)}
                  caption={
                    advanceDue > 0
                      ? null
                      : quoteMode
                        ? "Pay the artist at your visit. If this artist takes an advance, you'll see it after you confirm."
                        : "Pay the artist at your visit."
                  }
                />
                {advanceDue > 0 ? (
                  <>
                    <ReceiptRow label="Pay now (advance)" value={formatRupees(advanceDue)} />
                    <ReceiptRow
                      label="Pay the artist at your visit"
                      value={formatRupees(Math.max(0, totalDue - advanceDue))}
                    />
                    <Notice tone="peach" icon="time-outline">
                      Your time is held for 15 minutes while you pay.
                    </Notice>
                  </>
                ) : null}
              </BookingCard>

              {advanceDue > 0 && artist.cancellationPolicyLines?.length ? (
                <View style={styles.policyCard}>
                  <Text style={styles.policyTitle}>If you cancel</Text>
                  {artist.cancellationPolicyLines.map((line) => (
                    <Text key={line} style={styles.muted}>{`• ${line}`}</Text>
                  ))}
                </View>
              ) : null}

              {artist.cancellationPolicyText ? (
                <View style={styles.policyCard}>
                  <Text style={styles.muted}>{artist.cancellationPolicyText}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {error && showOneTap ? (
            <View style={[styles.pad, styles.noticeGap]}>
              <Notice tone="red" icon="alert-circle-outline">
                {error}
              </Notice>
            </View>
          ) : null}
        </ScrollView>

        {showOneTap ? null : (
          <BookingBar
            title={step < 2 ? barPrice : formatRupees(totalDue)}
            caption={step < 2 ? barNote : advanceDue > 0 ? null : "Pay the artist at your visit"}
            error={error}
            label={
              busy === "book"
                ? "Booking…"
                : step < 2
                  ? "Continue"
                  : advanceDue > 0
                    ? `Continue to pay ${formatRupees(advanceDue)}`
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
        )}
      </KeyboardAvoidingView>

      {showOneTap ? (
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
      ) : null}

      <BottomSheet
        visible={detailService != null}
        title="Service summary"
        onClose={() => setDetailService(null)}
      >
        {detailService ? (
          <View style={styles.detail}>
            <Text style={styles.detailTitle}>{detailService.name}</Text>
            <Text style={styles.detailMeta}>
              {formatDuration(detailService.durationMinutes)} ·{" "}
              {formatRupees(artistServiceUnitPrice(detailService, "studio"))} at studio
            </Text>
            {detailService.homeVisitPriceOverride != null ? (
              <Text style={styles.muted}>
                {formatRupees(detailService.homeVisitPriceOverride)} if artist comes to your home
              </Text>
            ) : null}
            {detailService.description ? (
              <Text style={styles.detailBody}>{detailService.description}</Text>
            ) : null}
            <View style={styles.detailCta}>
              {selectedIds.includes(detailService.id) ? (
                <OutlinePill
                  label="Remove from bag"
                  onPress={() => {
                    toggleService(detailService)
                    setDetailService(null)
                  }}
                />
              ) : (
                <PrimaryPill
                  label="Add to bag"
                  onPress={() => {
                    toggleService(detailService)
                    setDetailService(null)
                  }}
                />
              )}
            </View>
          </View>
        ) : null}
      </BottomSheet>
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

function WhereCard({
  icon,
  pastel,
  title,
  caption,
  active,
  onPress,
}: {
  icon: IconName
  pastel: Pastel
  title: string
  caption: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${title}, ${caption}`}
      style={({ pressed }) => [styles.whereCard, active && styles.whereCardOn, pressed && ui.pressed]}
    >
      <PastelIcon pastel={pastel} name={icon} size={44} />
      <Text style={styles.whereTitle}>{title}</Text>
      <Text style={styles.whereSub}>{caption}</Text>
      {active ? (
        <View style={styles.whereCheck}>
          <Icon name="checkmark" size={12} color="#ffffff" />
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexCopy: { flex: 1, minWidth: 0, gap: 2 },
  scrollContent: { flexGrow: 1, paddingBottom: 28 },
  scrollOneTap: { paddingBottom: 150 },
  pad: { paddingHorizontal: 16 },
  quoteWrap: { marginBottom: 4 },
  noticeGap: { marginTop: 12 },
  helper: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: bk.secondary,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  serviceList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: bk.border,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    paddingHorizontal: 14,
  },
  whereChoices: { flexDirection: "row", gap: 10 },
  whereCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: bk.border,
    backgroundColor: "#ffffff",
  },
  whereCardOn: { borderWidth: 2, borderColor: bk.text, paddingVertical: 17, paddingHorizontal: 9 },
  whereTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: bk.text,
    marginTop: 6,
    textAlign: "center",
  },
  whereSub: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: bk.secondary, textAlign: "center" },
  whereCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: bk.text,
    alignItems: "center",
    justifyContent: "center",
  },
  factRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  fact: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  factText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: bk.text },
  strong: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: bk.text },
  muted: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: bk.secondary },
  success: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 17, color: bk.green },
  error: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 17, color: bk.red },
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
  policyCard: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: "#f7f7f7", gap: 2 },
  policyTitle: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18, color: bk.text },
  detail: { gap: 6, paddingBottom: 16 },
  detailTitle: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, color: bk.text },
  detailMeta: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: bk.secondary },
  detailBody: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21, color: bk.body, marginTop: 10 },
  detailCta: { marginTop: 22 },
})
