import { Stack, useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native"

import {
  BOOKING_BAR_SPACE,
  BookingBar,
  BookingCard,
  BookingHeader,
  BookingSectionLabel,
  BookingSkeleton,
  DayStrip,
  FlowSuccess,
  Hairline,
  Notice,
  PlaceRow,
  SuccessLine,
  TimeGrid,
  bk,
  bookingStyles,
  displayTime,
} from "@/components/book/BookingUi"
import { SEE_ALL_EMPTY_COLORS, SeeAllEmpty } from "@/components/list/SeeAllParts"
import { Field } from "@/components/profile/ProfileScreenParts"
import { pastels } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Booking } from "@/data/types"
import { ApiError } from "@/lib/api"
import { formatBookingWhen, serviceSummary } from "@/lib/booking-display"
import { bookingPhotoUrl } from "@/lib/booking-photo"
import {
  fetchArtistRescheduleInfo,
  fetchArtistRescheduleSlots,
  requestArtistReschedule,
  withdrawArtistReschedule,
  type ArtistRescheduleInfo,
} from "@/lib/bookings-api"
import { fontFamily } from "@/theme/tokens"

const DAYS_AHEAD = 30

function dayKeys(count: number, timeZone: string) {
  const keys: string[] = []
  const now = Date.now()
  for (let i = 0; i < count; i++) {
    keys.push(new Date(now + i * 86_400_000).toLocaleDateString("en-CA", { timeZone }))
  }
  return keys
}

function slotLabel(iso: string, timeZone: string) {
  return displayTime(
    new Date(iso).toLocaleTimeString("en-IN", { timeZone, hour: "numeric", minute: "2-digit" }),
  )
}

/** "Tue 17 Nov, 2:30 PM" in the artist's time zone. */
function whenLabel(iso: string, timeZone: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  const day = date.toLocaleDateString("en-IN", { timeZone, weekday: "short", day: "numeric", month: "short" })
  return `${day}, ${slotLabel(iso, timeZone)}`
}

/** Ask a solo artist for a new time. The booking stays as it is until they approve in the Partner app. */
export function ArtistReschedule({ booking, onBack }: { booking: Booking; onBack: () => void }) {
  const router = useRouter()
  const artistName = booking.salonName
  const [info, setInfo] = useState<ArtistRescheduleInfo | null>(null)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const timeZone = info?.timezone || "Asia/Kolkata"
  const days = useMemo(() => dayKeys(DAYS_AHEAD, timeZone), [timeZone])
  const [date, setDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsMessage, setSlotsMessage] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentFor, setSentFor] = useState<string | null>(null)

  const loadInfo = useCallback(() => {
    setLoading(true)
    setInfoError(null)
    fetchArtistRescheduleInfo(booking.id)
      .then(setInfo)
      .catch((err) => {
        setInfo(null)
        setInfoError(err instanceof ApiError ? err.message : "Couldn't load this booking.")
      })
      .finally(() => setLoading(false))
  }, [booking.id])

  useEffect(() => {
    loadInfo()
  }, [loadInfo])

  // Start on the visit's own day when it's in range, otherwise today.
  useEffect(() => {
    if (!info || date) return
    const visitDay = new Date(info.startsAt).toLocaleDateString("en-CA", { timeZone })
    setDate(days.includes(visitDay) ? visitDay : days[0] ?? null)
  }, [info, date, days, timeZone])

  useEffect(() => {
    let active = true
    if (!info?.canRequest || !date) return
    setSlotsLoading(true)
    setSlotsMessage(null)
    fetchArtistRescheduleSlots(booking.id, date)
      .then((result) => {
        if (!active) return
        const next = result.slots ?? []
        setSlots(next)
        setSlotsMessage(result.message ?? null)
        setSlot((current) => (current && next.includes(current) ? current : null))
      })
      .catch((err) => {
        if (!active) return
        setSlots([])
        setSlot(null)
        setSlotsMessage(err instanceof ApiError ? err.message : "Couldn't load times. Please try again.")
      })
      .finally(() => {
        if (active) setSlotsLoading(false)
      })
    return () => {
      active = false
    }
  }, [booking.id, date, info?.canRequest])

  async function submit() {
    if (!slot) return
    setSubmitting(true)
    setError(null)
    try {
      await requestArtistReschedule(booking.id, { startAt: slot, ...(note.trim() ? { note: note.trim() } : {}) })
      setSentFor(slot)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your request. Please try again.")
      if (err instanceof ApiError && err.extras.code === "slot_taken") {
        setSlots((current) => current.filter((item) => item !== slot))
        setSlot(null)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function withdraw() {
    setWithdrawing(true)
    setError(null)
    try {
      await withdrawArtistReschedule(booking.id)
      setDate(null)
      loadInfo()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't withdraw the request. Please try again.")
    } finally {
      setWithdrawing(false)
    }
  }

  const summary = (
    <BookingCard style={styles.summary}>
      <PlaceRow
        imageUrl={bookingPhotoUrl(booking)}
        name={artistName}
        caption={booking.salonArea || null}
        meta={serviceSummary(booking) || null}
      />
      <Hairline />
      <View style={styles.currentRow}>
        <Icon name="calendar-outline" size={16} color={bk.secondary} />
        <Text style={styles.currentLabel}>Currently</Text>
        <Text style={styles.currentValue} numberOfLines={1}>
          {formatBookingWhen(booking)}
        </Text>
      </View>
    </BookingCard>
  )

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingSkeleton />
      </>
    )
  }

  if (sentFor) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <FlowSuccess
          icon="calendar-outline"
          pastel={pastels.mint}
          title="Request sent"
          message={`We've asked ${artistName} for the new time. Your booking stays as it is until they approve, and we'll let you know either way.`}
          primary={{ label: "View bookings", onPress: () => router.replace("/(tabs)/bookings") }}
        >
          <Text style={styles.doneName} numberOfLines={1}>
            {artistName}
          </Text>
          <SuccessLine label="Was" value={formatBookingWhen(booking)} struck />
          <SuccessLine label="Requested" value={whenLabel(sentFor, timeZone)} />
        </FlowSuccess>
      </>
    )
  }

  if (!info) {
    return (
      <View style={bookingStyles.page}>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingHeader title="Reschedule" subtitle={artistName} onBack={onBack} />
        <SeeAllEmpty
          icon="chatbubble-ellipses-outline"
          colors={SEE_ALL_EMPTY_COLORS.salons}
          title="Contact the artist to change the time"
          body={infoError ?? `${artistName} can't take new-time requests online yet.`}
          actionLabel="Back to bookings"
          onAction={() => router.replace("/(tabs)/bookings")}
        />
      </View>
    )
  }

  if (info.pending) {
    return (
      <View style={bookingStyles.page}>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingHeader title="Reschedule" subtitle={artistName} onBack={onBack} />
        <ScrollView
          style={bookingStyles.page}
          contentContainerStyle={[bookingStyles.body, { paddingBottom: BOOKING_BAR_SPACE }]}
          showsVerticalScrollIndicator={false}
        >
          <BookingSectionLabel first>Your booking</BookingSectionLabel>
          {summary}
          <View style={styles.notice}>
            <Notice tone="green" icon="time-outline">
              {`You asked to move this to ${whenLabel(info.pending.requestedStartsAt, timeZone)}. ${artistName} will reply soon. Until then your booking stays as it is.`}
            </Notice>
          </View>
        </ScrollView>
        <BookingBar
          title={`Requested ${whenLabel(info.pending.requestedStartsAt, timeZone)}`}
          caption="Waiting for the artist"
          label="Withdraw request"
          onPress={() => void withdraw()}
          loading={withdrawing}
          error={error}
        />
      </View>
    )
  }

  if (!info.canRequest) {
    return (
      <View style={bookingStyles.page}>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingHeader title="Reschedule" subtitle={artistName} onBack={onBack} />
        <SeeAllEmpty
          icon="time-outline"
          colors={SEE_ALL_EMPTY_COLORS.salons}
          title="Reschedule unavailable"
          body={info.reason ?? "This booking can't be moved online. Contact the artist."}
          actionLabel="Back to bookings"
          onAction={() => router.replace("/(tabs)/bookings")}
        />
      </View>
    )
  }

  return (
    <View style={bookingStyles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={bookingStyles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BookingHeader title="Reschedule" subtitle={artistName} onBack={onBack} />
        <ScrollView
          style={bookingStyles.page}
          contentContainerStyle={[bookingStyles.body, { paddingBottom: BOOKING_BAR_SPACE }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <BookingSectionLabel first>Your booking</BookingSectionLabel>
          {summary}

          <BookingSectionLabel>Pick a new day</BookingSectionLabel>
          <View style={styles.bleed}>
            <DayStrip
              options={days.map((day) => ({ date: day }))}
              value={date}
              onSelect={(next) => {
                setSlot(null)
                setDate(next)
              }}
            />
          </View>

          <BookingSectionLabel>Pick a new time</BookingSectionLabel>
          <TimeGrid
            options={slots.map((iso) => ({ value: iso, label: slotLabel(iso, timeZone) }))}
            value={slot}
            onSelect={setSlot}
            loading={slotsLoading}
            emptyMessage={slotsMessage || "No free times on this day. Try another date."}
          />

          <BookingSectionLabel>{`Note for ${artistName} (optional)`}</BookingSectionLabel>
          <Field
            value={note}
            onChangeText={(text: string) => setNote(text.slice(0, 300))}
            placeholder="e.g. Running late from work that day"
            accessibilityLabel={`Note for ${artistName}`}
            multiline
          />

          <View style={styles.notice}>
            <Notice icon="information-circle-outline">
              {`${artistName} approves the new time. Until then your booking stays as it is.`}
            </Notice>
          </View>
        </ScrollView>

        <BookingBar
          title={slot ? whenLabel(slot, timeZone) : "Pick a new time"}
          caption={`Was ${formatBookingWhen(booking)}`}
          label="Confirm new time"
          onPress={() => void submit()}
          disabled={!slot}
          loading={submitting}
          error={error}
        />
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  doneName: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: bk.text,
  },
  summary: { gap: 14 },
  currentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  currentLabel: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: bk.secondary },
  currentValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: bk.text,
  },
  bleed: { marginHorizontal: -16 },
  notice: { marginTop: 20 },
})
