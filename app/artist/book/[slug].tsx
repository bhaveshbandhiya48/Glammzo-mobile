import { Image } from "expo-image"
import { useLocalSearchParams, useNavigation, useRouter, type Href } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ArtistServiceRow } from "@/components/artists/ArtistServiceRow"
import { HomeVisitMapPicker } from "@/components/artists/HomeVisitMapPicker"
import { BookingDateSheet } from "@/components/book/BookingDateSheet"
import { BookingSelectTrigger } from "@/components/book/BookingSelectTrigger"
import { BookingTimeSheet } from "@/components/book/BookingTimeSheet"
import { BottomSheet } from "@/components/ui/BottomSheet"
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
import { ApiError } from "@/lib/api"
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
  } = useLocalSearchParams<{
    slug?: string
    serviceId?: string
    serviceIds?: string
    promo?: string
  }>()
  const safeSlug = (slug ?? "").trim().toLowerCase()
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
  const [error, setError] = useState<string | null>(null)

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
    const multi =
      typeof serviceIdsParam === "string" ? serviceIdsParam.trim() : ""
    if (multi) return `${base}?serviceIds=${encodeURIComponent(multi)}`
    const sid = typeof serviceIdParam === "string" ? serviceIdParam.trim() : ""
    return sid ? `${base}?serviceId=${encodeURIComponent(sid)}` : base
  }, [safeSlug, serviceIdParam, serviceIdsParam])

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
          const seed = valid.length > 0 ? valid : data.services[0] ? [data.services[0].id] : []
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
  const quoteTotal = quote ? Math.round(quote.total) : 0
  const serviceSubtotal = quote ? Math.round(quote.servicePrice) : 0
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
  const advanceDue = Math.min(quote?.advance ?? 0, payableTotal)
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
    setBusy("book")
    setError(null)
    try {
      // Keep session warm for CRM; booking itself goes through Glammzo-web for rewards.
      await ensureVerifiedSession()
      const res = await createArtistBookingWithRewards({
        slug: artist.slug,
        serviceIds: selectedIds,
        startAt: slot,
        locationType,
        address: address.trim(),
        landmark: landmark.trim() || null,
        lat: pin?.lat,
        lng: pin?.lng,
        fullName: name.trim(),
        promoCode: appliedPromoCode || undefined,
        useWallet: useWallet && walletBalance > 0,
        useFreeService: useLoyalty && loyaltyAvailable,
      })
      const dateKey = new Date(res.booking.startsAt).toLocaleDateString("en-CA", {
        timeZone: timezone,
      })
      // The artist asks for an advance: pay it on Glammzo's secure web page (not in-app purchase).
      if (res.awaitingPayment && res.payUrl) {
        void Linking.openURL(res.payUrl)
      }
      router.replace({
        pathname: "/book/confirmation",
        params: {
          kind: "artist",
          salonId: artist.slug,
          bookingId: `artist:${res.booking.token}`,
          total: String(Math.round(res.payable ?? payableTotal)),
          slot: formatSlot(res.booking.startsAt, timezone),
          name: name.trim(),
          date: dateKey,
          status: res.awaitingPayment ? "pending" : "confirmed",
          ...(res.awaitingPayment && res.payUrl ? { payUrl: res.payUrl } : {}),
          services: selectedServices.map((s) => s.name).join(" · "),
          visitType: locationType === "client_home" ? "Home visit" : "Studio visit",
          area: [artist.area, artist.city].filter(Boolean).join(", "),
          providerName: artist.displayName,
          photoUrl: artist.profilePhotoUrl ?? "",
        },
      } as Href)
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Couldn't book."
      setError(message)
      if (/no longer available/i.test(message)) setSlot(null)
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
          onPress={() => {
            if (step > 0) setStep((prev) => prev - 1)
            else if (router.canGoBack()) router.back()
            else router.replace("/(tabs)/explore" as Href)
          }}
          hitSlop={8}
          accessibilityRole="button"
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
        <ActivityIndicator color={colors.coral} />
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
  const homeServicePremium = selectedServices.reduce((sum, s) => {
    const studio = artistServiceUnitPrice(s, "studio")
    const home = artistServiceUnitPrice(s, "client_home")
    return sum + Math.max(0, home - studio)
  }, 0)
  const travelFee = quote?.travelFee ?? 0
  const hasVisitExtras =
    needsHome && (homeServicePremium > 0 || travelFee > 0)

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
            ? "Review your services"
            : step === 1
              ? "When and where"
              : "Review and confirm"}
        </Text>

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
                    <Text variant="heading" color={colors.coral}>
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
                  Services
                </Text>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/artist/[slug]",
                      params: { slug: artist.slug },
                    } as Href)
                  }
                >
                  <Text variant="caption" color={colors.coral}>
                    Edit
                  </Text>
                </Pressable>
              </View>
              <View style={styles.serviceList}>
                {selectedServices.map((s, index) => (
                  <ArtistServiceRow
                    key={s.id}
                    service={s}
                    selected
                    isLast={index === selectedServices.length - 1}
                    pricingLocation="studio"
                    onOpenDetail={() => setDetailService(s)}
                    onToggle={() => toggleService(s)}
                  />
                ))}
              </View>
              {selectedServices.length > 0 ? (
                <Text variant="caption" muted>
                  Services · {formatRupees(servicesSubtotal)}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <View style={styles.section}>
              <Text variant="heading">Where is the visit?</Text>
              <Text variant="caption" muted>
                Choose studio or home. Home visit prices and travel fees update the
                total below.
              </Text>
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
                      color={locationType === "studio" ? colors.coral : colors.textMuted}
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
                        locationType === "client_home" ? colors.coral : colors.textMuted
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
            </View>

            <View style={styles.card}>
              <Text variant="caption" muted>
                Price breakdown
              </Text>
              <View style={styles.priceRow}>
                <Text variant="body">
                  Services
                  {needsHome && quote ? " (home rates)" : ""}
                </Text>
                <Text variant="bodyStrong">
                  {formatRupees(quote?.servicePrice ?? servicesSubtotal)}
                </Text>
              </View>
              {travelFee > 0 ? (
                <View style={styles.priceRow}>
                  <Text variant="body">
                    Travel fee
                    {quote?.distanceKm != null
                      ? ` · ${quote.distanceKm.toFixed(1)} km`
                      : ""}
                  </Text>
                  <Text variant="bodyStrong">{formatRupees(travelFee)}</Text>
                </View>
              ) : needsHome &&
                artist.travelFeeType !== "none" &&
                artist.travelFeeAmount > 0 &&
                awaitingPin ? (
                <Text variant="caption" muted style={{ marginTop: spacing.xs }}>
                  Travel fee will be added once your location pin is set.
                </Text>
              ) : null}
              {hasVisitExtras && quote ? (
                <Text variant="caption" muted style={{ marginTop: spacing.xs }}>
                  Includes
                  {homeServicePremium > 0 ? " home visit rates" : ""}
                  {homeServicePremium > 0 && travelFee > 0 ? " and" : ""}
                  {travelFee > 0 ? " travel" : ""}
                  .
                </Text>
              ) : null}
              <View style={[styles.priceRow, { marginTop: spacing.sm }]}>
                <Text variant="heading">Total</Text>
                <Text variant="heading">
                  {quote
                    ? formatRupees(quote.total)
                    : needsHome && awaitingPin
                      ? "—"
                      : formatRupees(servicesSubtotal)}
                </Text>
              </View>
              {needsHome && awaitingPin ? (
                <Text
                  variant="caption"
                  color={colors.destructive}
                  style={{ marginTop: 4 }}
                >
                  Add your location to see the final home-visit total.
                </Text>
              ) : null}
              {quote && quote.advance > 0 ? (
                <View style={{ marginTop: spacing.sm, gap: 4 }}>
                  <View style={styles.priceRow}>
                    <Text variant="label">Pay now to confirm (advance)</Text>
                    <Text variant="label">{formatRupees(quote.advance)}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text variant="caption" muted>Pay the artist at your visit</Text>
                    <Text variant="caption" muted>{formatRupees(Math.max(0, quote.total - quote.advance))}</Text>
                  </View>
                  <Text variant="caption" muted>
                    {artist.displayName} asks for an advance. After you book, you&apos;ll pay it securely on
                    Glammzo (UPI, card or net banking). Your time is held for 15 minutes.
                  </Text>
                  {artist.cancellationPolicyLines?.length ? (
                    <View style={{ gap: 2, marginTop: 4 }}>
                      <Text variant="label">If you cancel</Text>
                      {artist.cancellationPolicyLines.map((line) => (
                        <Text key={line} variant="caption" muted>{`• ${line}`}</Text>
                      ))}
                    </View>
                  ) : null}
                </View>
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
                  <Pressable onPress={clearPromo} hitSlop={8}>
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

            <View style={[styles.card, styles.rewardsCard]}>
              <Text variant="label" muted>
                Wallet & loyalty
              </Text>

              <Pressable
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
                  <Icon name="wallet-outline" size={20} color={colors.coral} />
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
                          : colors.coral
                    }
                  >
                    {walletBalance <= 0 ? "Unavailable" : useWallet ? "Applied" : "Apply"}
                  </Text>
                </View>
              </Pressable>

              <Pressable
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
                  <Icon name="ribbon-outline" size={20} color={colors.coral} />
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
                          : colors.coral
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
                  Services
                  {needsHome ? " (home rates)" : ""}
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
                <Text variant="heading">{formatRupees(payableTotal)}</Text>
              </View>
              {advanceDue > 0 ? (
                <>
                  <View style={styles.summaryRow}>
                    <Text variant="bodyStrong">Pay now (advance)</Text>
                    <Text variant="bodyStrong">{formatRupees(advanceDue)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text muted>Pay the artist at your visit</Text>
                    <Text muted>{formatRupees(payableTotal - advanceDue)}</Text>
                  </View>
                  <Text variant="caption" muted>
                    After you book, you&apos;ll pay the advance securely on Glammzo (UPI, card or net
                    banking). Your time is held for 15 minutes.
                  </Text>
                </>
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

      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button
          label={
            busy === "book"
              ? "Booking…"
              : step === 0
                ? "Continue"
                : step === 1
                  ? "Continue"
                  : advanceDue > 0
                    ? `Book and pay ${formatRupees(advanceDue)} now`
                    : quote
                      ? `Confirm · ${formatRupees(payableTotal)}`
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
              {detailService.durationMinutes} min ·{" "}
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
    borderColor: colors.coral,
    backgroundColor: "#FFF7F5",
  },
  whereCardTitle: { textAlign: "center" },
  whereCardSub: { textAlign: "center" },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
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
    borderColor: colors.coral,
    backgroundColor: "#FFF7F5",
  },
  rewardDisabled: {
    opacity: 0.55,
  },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: "#FFF0ED",
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
    borderColor: colors.coral,
    backgroundColor: colors.surface,
  },
  applyChipOn: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
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
