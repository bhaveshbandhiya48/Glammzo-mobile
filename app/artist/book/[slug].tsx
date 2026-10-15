import { Image } from "expo-image"
import { useLocalSearchParams, useNavigation, useRouter, type Href } from "expo-router"
import { useEffect, useMemo, useState } from "react"
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
import { BookingTimeSheet } from "@/components/book/BookingTimeSheet"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
import { Screen } from "@/components/ui/Screen"
import { Text } from "@/components/ui/Text"
import {
  artistServiceUnitPrice,
  createArtistPublicBooking,
  fetchArtistSlots,
  fetchPublicArtist,
  issueArtistVerificationFromSession,
  type ArtistBookingQuote,
  type ArtistLocationType,
  type PublicArtist,
  type PublicArtistService,
} from "@/lib/artists-api"
import { fetchMe } from "@/lib/auth-api"
import { loadProfilePreferApi } from "@/lib/profile-api"
import { formatRupees } from "@/lib/service-pricing"
import { getAccessToken } from "@/lib/session"
import {
  getSavedLocation,
  normalizeMobileDigits,
  patchConsumerProfileCache,
} from "@/lib/user"
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
  const { slug, serviceId: serviceIdParam, serviceIds: serviceIdsParam } = useLocalSearchParams<{
    slug?: string
    serviceId?: string
    serviceIds?: string
  }>()
  const safeSlug = (slug ?? "").trim().toLowerCase()

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
  const [done, setDone] = useState<{
    token: string
    startsAt: string
    quote: ArtistBookingQuote
    awaitingPayment: boolean
  } | null>(null)

  const timezone = artist?.timezone || "Asia/Kolkata"
  const days = useMemo(() => dayKeys(new Date(), 14, timezone), [timezone])
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
      const session = await ensureVerifiedSession()
      if (!/^[6-9]\d{9}$/.test(session.phone)) {
        setError("Your account needs a verified mobile number.")
        return
      }
      const res = await createArtistPublicBooking({
        slug: artist.slug,
        serviceIds: selectedIds,
        startAt: slot,
        locationType,
        address: address.trim(),
        landmark: landmark.trim() || null,
        lat: pin?.lat,
        lng: pin?.lng,
        fullName: name.trim(),
        phone: session.phone,
        verificationToken: session.token,
      })
      setDone({
        token: res.booking.token,
        startsAt: res.booking.startsAt,
        quote: res.quote,
        awaitingPayment: res.awaitingPayment,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't book."
      setError(message)
      if (/no longer available/i.test(message)) setSlot(null)
    } finally {
      setBusy(null)
    }
  }

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

  if (done && selectedServices.length > 0) {
    const when = new Date(done.startsAt).toLocaleString("en-IN", {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    })
    const serviceLabel = selectedServices.map((s) => s.name).join(" · ")
    return (
      <Screen scroll contentStyle={styles.scroll} edges={["top", "left", "right"]}>
        <Icon name="checkmark-circle" size={48} color={colors.coral} />
        <Text variant="title">You're booked</Text>
        <Text variant="body" muted>
          {serviceLabel} with {artist.displayName}
        </Text>
        <View style={styles.card}>
          <Text variant="heading">{when}</Text>
          <Text variant="body" muted style={{ marginTop: spacing.sm }}>
            Total {formatRupees(done.quote.total)}
          </Text>
        </View>
        <Button
          label="Done"
          onPress={() =>
            router.replace({
              pathname: "/artist/[slug]",
              params: { slug: artist.slug },
            } as Href)
          }
        />
      </Screen>
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
              {quote ? (
                <>
                  <View style={styles.priceRow}>
                    <Text variant="body">
                      Services
                      {needsHome ? " (home rates)" : ""}
                    </Text>
                    <Text variant="bodyStrong">
                      {formatRupees(quote.servicePrice)}
                    </Text>
                  </View>
                  {travelFee > 0 ? (
                    <View style={styles.priceRow}>
                      <Text variant="body">
                        Travel fee
                        {quote.distanceKm != null
                          ? ` · ${quote.distanceKm.toFixed(1)} km`
                          : ""}
                      </Text>
                      <Text variant="bodyStrong">{formatRupees(travelFee)}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.priceRow, { marginTop: spacing.sm }]}>
                    <Text variant="heading">Total</Text>
                    <Text variant="heading">{formatRupees(quote.total)}</Text>
                  </View>
                </>
              ) : null}
            </View>
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
})
