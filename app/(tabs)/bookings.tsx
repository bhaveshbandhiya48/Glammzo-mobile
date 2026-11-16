import { useCallback, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useFocusEffect, useRouter } from "expo-router"

import { BookingCompactCard, BookingHeroCard } from "@/components/bookings/BookingCards"
import { BookingDetailsSheet, CancelBookingSheet } from "@/components/bookings/BookingDetailsSheet"
import { advanceDueToken } from "@/components/bookings/BookingPayStrip"
import { ActionPill } from "@/components/bookings/BookingPills"
import {
  BookingsEmpty,
  BookingsError,
  BookingsSignedOut,
  BookingsSkeleton,
} from "@/components/bookings/BookingsStates"
import { bookingSortMs, groupByMonth, groupUpcoming } from "@/components/bookings/bookingGroups"
import { WaitlistStrip } from "@/components/bookings/WaitlistStrip"
import { GradientFill } from "@/components/home/GradientFill"
import { sp, ui } from "@/components/salon-page/theme"
import { useCollapseTabBarOnScroll, useFloatingTabBarSpace } from "@/components/ui/FloatingTabBar"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Text } from "@/components/ui/Text"
import type { Booking, BookingStatus } from "@/data/types"
import { ApiError } from "@/lib/api"
import { FILTER_LABELS, isArtistBooking } from "@/lib/booking-display"
import { cancelArtistPublicBooking } from "@/lib/artists-api"
import { cancelBooking, fetchBookings, withPaymentStatus } from "@/lib/bookings-api"
import { useCart } from "@/context/CartContext"
import { bookingPhotoUrl } from "@/lib/booking-photo"
import { canRescheduleWithNotice } from "@/lib/reschedule-policy"
import { openDirections } from "@/lib/visit-links"
import { getAccessToken } from "@/lib/session"
import { fontFamily } from "@/theme/tokens"

type Filter = keyof typeof FILTER_LABELS

const upcomingStatuses: BookingStatus[] = ["pending", "confirmed", "upcoming"]
const cancelledStatuses: BookingStatus[] = ["cancelled", "declined", "expired", "payment_failed"]

const CANCEL_REASON_IDS = [
  "change_of_plans",
  "found_another",
  "different_time",
  "artist_asked",
  "other",
] as const

type CancelReasonId = (typeof CANCEL_REASON_IDS)[number]

function cancelReasonsFor(kind: "salon" | "artist") {
  return [
    { id: "change_of_plans" as const, label: "Change of plans" },
    {
      id: "found_another" as const,
      label: kind === "artist" ? "Found another artist" : "Found another salon",
    },
    { id: "different_time" as const, label: "Timing no longer works" },
    // Artist bookings only: Glammzo counts it as the artist's cancellation.
    ...(kind === "artist"
      ? [{ id: "artist_asked" as const, label: "Artist asked me to cancel / book outside the app" }]
      : []),
    { id: "other" as const, label: "Other" },
  ]
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={[ui.sectionLabel, page.sectionLabel]}>{children}</Text>
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets()
  const tabBarSpace = useFloatingTabBarSpace()
  const onTabBarScroll = useCollapseTabBarOnScroll()
  const cart = useCart()
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<Booking | null>(null)

  /** A held slot just ran out on screen: it shows as Payment failed without a reload. */
  const applyPaymentTimeouts = useCallback(() => {
    setBookings((current) => current.map((booking) => withPaymentStatus(booking)))
    setSelected((current) => (current ? withPaymentStatus(current) : current))
  }, [])
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState<CancelReasonId>("change_of_plans")
  const [cancelNote, setCancelNote] = useState("")
  const [cancelling, setCancelling] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function reloadBookings() {
    setLoading(true)
    setLoadError(null)
    try {
      const next = await fetchBookings()
      setBookings(next)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthed(false)
        setBookings([])
        setLoadError(null)
        return
      }
      setBookings([])
      const message =
        error instanceof ApiError
          ? error.message
          : "Could not load bookings. Check your connection and try again."
      setLoadError(message)
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      ;(async () => {
        const token = await getAccessToken()
        if (cancelled) return
        setAuthed(Boolean(token))
        setAuthChecked(true)
        if (!token) {
          setLoading(false)
          setBookings([])
          setLoadError(null)
          return
        }
        setLoading(true)
        setLoadError(null)
        try {
          const next = await fetchBookings()
          if (cancelled) return
          setBookings(next)
        } catch (error) {
          if (cancelled) return
          if (error instanceof ApiError && error.status === 401) {
            setAuthed(false)
            setBookings([])
            setLoadError(null)
            return
          }
          setBookings([])
          const message =
            error instanceof ApiError
              ? error.message
              : "Could not load bookings. Check your connection and try again."
          setLoadError(message)
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }, []),
  )

  const counts = useMemo(() => {
    return {
      all: bookings.length,
      upcoming: bookings.filter((b) => upcomingStatuses.includes(b.status)).length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => cancelledStatuses.includes(b.status)).length,
    }
  }, [bookings])

  const list = useMemo(() => {
    return bookings.filter((booking) => {
      if (filter === "all") return true
      if (filter === "upcoming") return upcomingStatuses.includes(booking.status)
      if (filter === "cancelled") return cancelledStatuses.includes(booking.status)
      return booking.status === filter
    })
  }, [bookings, filter])

  /** Upcoming soonest first (the first one is the hero); everything else newest first, by month. */
  const sections = useMemo(() => {
    const upcoming = list
      .filter((b) => upcomingStatuses.includes(b.status))
      .sort((a, b) => bookingSortMs(a) - bookingSortMs(b))
    const past = list
      .filter((b) => !upcomingStatuses.includes(b.status))
      .sort((a, b) => bookingSortMs(b) - bookingSortMs(a))
    return {
      hero: upcoming[0] ?? null,
      upcomingGroups: groupUpcoming(upcoming.slice(1)),
      pastGroups: groupByMonth(past),
    }
  }, [list])

  const subtitle = useMemo(() => {
    if (!authChecked || (authed && loading && bookings.length === 0)) return "Loading your appointments…"
    if (!authed) return "Sign in to see salon and solo-artist visits."
    if (counts.upcoming > 0) return `${counts.upcoming} upcoming · ${counts.all} total`
    if (counts.all > 0) return `No upcoming visits · ${counts.all} total`
    return "No upcoming visits"
  }, [authChecked, authed, loading, bookings.length, counts.upcoming, counts.all])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  /** Same services (and stylist) as this booking, straight to picking a time. */
  function bookAgain(booking: Booking) {
    setSelected(null)
    if (isArtistBooking(booking)) {
      const slug = booking.artistSlug || booking.salonId
      router.push({
        pathname: "/artist/book/[slug]",
        params: booking.artistServiceId ? { slug, serviceIds: booking.artistServiceId } : { slug },
      })
      return
    }
    const serviceIds = booking.services.map((s) => s.id).filter((id) => id && id !== "service")
    if (serviceIds.length === 0) {
      router.push({ pathname: "/salon/[id]", params: { id: booking.salonId } })
      return
    }
    cart.clearSalon(booking.salonId)
    for (const id of serviceIds) cart.toggleService(booking.salonId, id)
    router.push({
      pathname: "/book/[salonId]",
      params: booking.staffId ? { salonId: booking.salonId, staffId: booking.staffId } : { salonId: booking.salonId },
    })
  }

  /** Same rules as the details sheet's Book again button. */
  function canBookAgain(booking: Booking) {
    if (!isArtistBooking(booking)) return true
    return Boolean(booking.artistSlug || booking.salonId) &&
      (upcomingStatuses.includes(booking.status) || booking.status === "completed")
  }

  function artistToken(booking: Booking) {
    return booking.artistPublicToken?.trim() || booking.id.replace(/^artist:/, "").trim()
  }

  /** Same rules as the details sheet's Leave a review button. */
  function canReview(booking: Booking) {
    if (booking.status !== "completed" || booking.hasVerifiedReview) return false
    return isArtistBooking(booking) ? Boolean(artistToken(booking)) : true
  }

  function openReview(booking: Booking) {
    setSelected(null)
    const photo = bookingPhotoUrl(booking)
    if (isArtistBooking(booking)) {
      router.push({
        pathname: "/review",
        params: {
          kind: "artist",
          artistPublicToken: artistToken(booking),
          salonName: booking.salonName,
          ...(photo ? { imageUrl: photo } : {}),
        },
      })
      return
    }
    const staffName = booking.staffName?.trim() || ""
    router.push({
      pathname: "/review",
      params: {
        appointmentId: booking.id,
        salonName: booking.salonName,
        ...(staffName ? { staffName } : {}),
        ...(photo ? { imageUrl: photo } : {}),
      },
    })
  }

  function heroActions(booking: Booking) {
    const artist = isArtistBooking(booking)
    const canReschedule = !artist && canRescheduleWithNotice(booking.startsAt).allowed
    // Same rule as Home's next-booking card: salon visits with nothing left to pay.
    const canDirect = !artist && !advanceDueToken(booking)
    return (
      <>
        <ActionPill label="View details" onPress={() => setSelected(booking)} />
        {canDirect ? (
          <ActionPill
            label="Directions"
            icon="navigate-outline"
            outline
            onPress={() =>
              openDirections({ query: [booking.salonName, booking.salonArea].filter(Boolean).join(", ") })
            }
          />
        ) : null}
        {canReschedule ? (
          <ActionPill
            label="Reschedule"
            outline
            onPress={() => router.push({ pathname: "/bookings/[id]/reschedule", params: { id: booking.id } })}
          />
        ) : null}
      </>
    )
  }

  function pastActions(booking: Booking) {
    if (upcomingStatuses.includes(booking.status)) return undefined
    const review = canReview(booking)
    const again = canBookAgain(booking)
    if (!review && !again) return undefined
    return (
      <>
        {review ? <ActionPill small label="Rate" icon="star-outline" onPress={() => openReview(booking)} /> : null}
        {again ? <ActionPill small outline label="Book again" onPress={() => bookAgain(booking)} /> : null}
      </>
    )
  }

  function renderCompact(booking: Booking) {
    return (
      <BookingCompactCard
        key={booking.id}
        booking={booking}
        onPress={() => setSelected(booking)}
        onPaymentExpired={applyPaymentTimeouts}
        actions={pastActions(booking)}
      />
    )
  }

  const header = (
    <View style={[page.header, { paddingTop: insets.top + 12 }]}>
      <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />
      <Text style={page.title} accessibilityRole="header">
        My bookings
      </Text>
      <Text style={page.subtitle} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  )

  if (!authChecked || !authed) {
    return (
      <ScrollView
        style={page.page}
        contentContainerStyle={{ paddingBottom: tabBarSpace + 16 }}
        showsVerticalScrollIndicator={false}
        onScroll={onTabBarScroll}
        scrollEventThrottle={16}
      >
        {header}
        <View style={page.body}>
          {!authChecked || loading ? (
            <BookingsSkeleton />
          ) : (
            <BookingsSignedOut
              onSignIn={() =>
                router.push({ pathname: "/login", params: { next: "/(tabs)/bookings" } })
              }
            />
          )}
        </View>
      </ScrollView>
    )
  }

  const { hero, upcomingGroups, pastGroups } = sections

  return (
    <View style={page.page}>
      <ScrollView
        style={page.page}
        contentContainerStyle={{ paddingBottom: tabBarSpace + 16 }}
        showsVerticalScrollIndicator={false}
        onScroll={onTabBarScroll}
        scrollEventThrottle={16}
      >
        {header}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={page.chips}
          style={page.chipsScroll}
        >
          {(Object.keys(FILTER_LABELS) as Filter[]).map((item) => {
            const active = filter === item
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${FILTER_LABELS[item]}, ${counts[item]}`}
                key={item}
                style={({ pressed }) => [ui.chip, page.chip, active && ui.chipActive, pressed && ui.pressed]}
                onPress={() => setFilter(item)}
              >
                <Text style={[ui.chipText, active && ui.chipTextActive]}>{FILTER_LABELS[item]}</Text>
                <Text style={[page.chipCount, active && page.chipCountActive]}>{counts[item]}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={page.body}>
          {toast ? (
            <View style={page.toast}>
              <Text style={page.toastText}>{toast}</Text>
            </View>
          ) : null}
          <WaitlistStrip />

          {loading ? (
            <View style={page.top}>
              <BookingsSkeleton />
            </View>
          ) : loadError ? (
            <BookingsError message={loadError} onRetry={() => void reloadBookings()} />
          ) : list.length === 0 ? (
            <BookingsEmpty filter={filter} onFind={() => router.push("/(tabs)")} />
          ) : (
            <>
              {hero ? (
                <View style={page.top}>
                  <SectionLabel>Next visit</SectionLabel>
                  <BookingHeroCard
                    booking={hero}
                    onPress={() => setSelected(hero)}
                    onPaymentExpired={applyPaymentTimeouts}
                    actions={heroActions(hero)}
                  />
                </View>
              ) : null}
              {upcomingGroups.map((group) => (
                <View key={`u-${group.label}`} style={page.group}>
                  <SectionLabel>{group.label}</SectionLabel>
                  {group.items.map(renderCompact)}
                </View>
              ))}
              {pastGroups.map((group) => (
                <View key={`p-${group.label}`} style={page.group}>
                  <SectionLabel>{group.label}</SectionLabel>
                  {group.items.map(renderCompact)}
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      <BottomSheet
        visible={Boolean(selected)}
        title={cancelOpen ? "Cancel booking" : "Appointment details"}
        contentKey={cancelOpen ? "cancel" : "details"}
        onClose={() => {
          // One sheet, two modes — avoid nested Modals (cancel never opened on device).
          if (cancelOpen) {
            setCancelOpen(false)
            return
          }
          setSelected(null)
        }}
      >
        {selected && cancelOpen ? (
          <CancelBookingSheet
            booking={selected}
            reasons={cancelReasonsFor(isArtistBooking(selected) ? "artist" : "salon")}
            reason={cancelReason}
            onReason={setCancelReason}
            note={cancelNote}
            onNote={setCancelNote}
            cancelling={cancelling}
            onKeep={() => setCancelOpen(false)}
            onConfirm={() => {
              void (async () => {
                if (cancelReason === "other" && !cancelNote.trim()) {
                  showToast("Please add a note for Other")
                  return
                }
                setCancelling(true)
                try {
                  if (isArtistBooking(selected)) {
                    const token =
                      selected.artistPublicToken?.trim() ||
                      selected.id.replace(/^artist:/, "").trim()
                    if (!token) throw new Error("Cancel unavailable for this booking.")
                    const reasons = cancelReasonsFor("artist")
                    const reasonLabel =
                      reasons.find((item) => item.id === cancelReason)?.label ?? cancelReason
                    const details = cancelNote.trim()
                    await cancelArtistPublicBooking({
                      publicToken: token,
                      reason: details ? `${reasonLabel}: ${details}` : reasonLabel,
                      reasonId: cancelReason,
                    })
                  } else {
                    await cancelBooking(selected.id, {
                      reasonId: cancelReason,
                      details: cancelNote.trim() || undefined,
                    })
                  }
                  setCancelOpen(false)
                  setSelected(null)
                  setCancelNote("")
                  showToast("Booking cancelled")
                  await reloadBookings()
                } catch (err) {
                  showToast(
                    err instanceof ApiError || err instanceof Error
                      ? err.message
                      : "Cancel failed",
                  )
                } finally {
                  setCancelling(false)
                }
              })()
            }}
          />
        ) : selected ? (
          <BookingDetailsSheet
            booking={selected}
            onPaymentExpired={applyPaymentTimeouts}
            canReview={canReview(selected)}
            onReview={() => openReview(selected)}
            onBookAgain={() => bookAgain(selected)}
            onViewProvider={() => {
              const artist = isArtistBooking(selected)
              const slug = selected.artistSlug || selected.salonId
              setSelected(null)
              if (artist) {
                router.push({ pathname: "/artist/[slug]", params: { slug } })
              } else {
                router.push({ pathname: "/salon/[id]", params: { id: slug } })
              }
            }}
            onReschedule={() => {
              const id = selected.id
              setSelected(null)
              router.push({ pathname: "/bookings/[id]/reschedule", params: { id } })
            }}
            onStartCancel={() => {
              setCancelReason("change_of_plans")
              setCancelNote("")
              setCancelOpen(true)
            }}
          />
        ) : null}
      </BottomSheet>
    </View>
  )
}

const page = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  title: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 30, color: sp.text },
  subtitle: { marginTop: 4, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 19, color: sp.secondary },
  chipsScroll: { flexGrow: 0 },
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  chip: { height: 36 },
  chipCount: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, color: sp.secondary },
  chipCountActive: { color: "rgba(255,255,255,0.75)" },
  body: { paddingHorizontal: 16 },
  top: { marginTop: 20, gap: 10 },
  group: { marginTop: 24, gap: 10 },
  sectionLabel: { paddingHorizontal: 4 },
  toast: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: sp.grey },
  toastText: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: sp.text },
})
