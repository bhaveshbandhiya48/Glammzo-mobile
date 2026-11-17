import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useMemo, useState } from "react"
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
import { ArtistReschedule } from "@/components/bookings/ArtistReschedule"
import { SEE_ALL_EMPTY_COLORS, SeeAllEmpty } from "@/components/list/SeeAllParts"
import { Field } from "@/components/profile/ProfileScreenParts"
import { pastels } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Booking } from "@/data/types"
import { ApiError } from "@/lib/api"
import {
  fetchAvailability,
  type AvailabilityDay,
  type AvailabilitySlot,
} from "@/lib/availability-api"
import { formatBookingWhen, isArtistBooking, serviceSummary } from "@/lib/booking-display"
import { bookingPhotoUrl } from "@/lib/booking-photo"
import { fetchBookingById, rescheduleBooking } from "@/lib/bookings-api"
import {
  canRescheduleWithNotice,
  getRescheduleBlockedReason,
} from "@/lib/reschedule-policy"
import { fontFamily } from "@/theme/tokens"

function formatDayChip(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export default function RescheduleScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [booking, setBooking] = useState<Booking | undefined>()
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dateOverride, setDateOverride] = useState<string | null>(null)
  const [days, setDays] = useState<AvailabilityDay[]>([])
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [slotValue, setSlotValue] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsMessage, setSlotsMessage] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serviceIds = useMemo(
    () => (booking?.services ?? []).map((service) => service.id).filter(Boolean),
    [booking],
  )

  const selectedSlotLabel =
    slots.find((slot) => slot.value === slotValue)?.label ?? slotValue ?? "—"

  useEffect(() => {
    let active = true
    if (typeof id !== "string") {
      setLoading(false)
      return
    }
    fetchBookingById(id)
      .then((next) => {
        if (active) setBooking(next)
      })
      .catch(() => {
        if (active) setBooking(undefined)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    let active = true
    // Artist bookings load their own times (ArtistReschedule).
    if (!booking || isArtistBooking(booking) || serviceIds.length === 0) return

    setSlotsLoading(true)
    setSlotsMessage(null)
    fetchAvailability({
      salonId: booking.salonId,
      date: dateOverride ?? undefined,
      serviceIds,
    })
      .then((result) => {
        if (!active) return
        setDays(result.days)
        setSelectedDate(result.date)
        setSlots(result.slots)
        setSlotsMessage(result.closed ? result.closedMessage : null)
        setSlotValue((prev) => {
          if (prev && result.slots.some((slot) => slot.value === prev)) return prev
          return null
        })
      })
      .catch((err) => {
        if (!active) return
        setSlots([])
        setSlotValue(null)
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
  }, [booking, serviceIds, dateOverride])

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/bookings")
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingSkeleton />
      </>
    )
  }

  if (!booking) {
    return (
      <View style={bookingStyles.page}>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingHeader title="Reschedule" onBack={goBack} />
        <SeeAllEmpty
          icon="calendar-clear-outline"
          colors={SEE_ALL_EMPTY_COLORS.error}
          title="Booking not found"
          body="It may have been cancelled or removed."
          actionLabel="Back to bookings"
          onAction={() => router.replace("/(tabs)/bookings")}
        />
      </View>
    )
  }

  if (isArtistBooking(booking)) {
    return <ArtistReschedule booking={booking} onBack={goBack} />
  }

  if (!canRescheduleWithNotice(booking.startsAt).allowed) {
    return (
      <View style={bookingStyles.page}>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingHeader title="Reschedule" subtitle={booking.salonName} onBack={goBack} />
        <SeeAllEmpty
          icon="time-outline"
          colors={SEE_ALL_EMPTY_COLORS.salons}
          title="Reschedule unavailable"
          body={getRescheduleBlockedReason(booking.startsAt) ?? "This booking can't be moved now."}
          actionLabel="Back to bookings"
          onAction={() => router.replace("/(tabs)/bookings")}
        />
      </View>
    )
  }

  if (done) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <FlowSuccess
          icon="calendar-outline"
          pastel={pastels.mint}
          title="Reschedule requested"
          message={`The ${isArtistBooking(booking) ? "artist" : "salon"} will confirm the new time.`}
          primary={{ label: "View bookings", onPress: () => router.replace("/(tabs)/bookings") }}
        >
          <Text style={styles.doneName} numberOfLines={1}>
            {booking.salonName}
          </Text>
          <SuccessLine label="Was" value={formatBookingWhen(booking)} struck />
          <SuccessLine
            label="Requested"
            value={`${selectedDate ? formatDayChip(selectedDate) : "—"} · ${displayTime(selectedSlotLabel)}`}
          />
        </FlowSuccess>
      </>
    )
  }

  const dayOptions = days.map((day) => ({
    date: day.date,
    disabled: day.availableCount === 0,
  }))
  const who = isArtistBooking(booking) ? "artist" : "salon"
  const services = serviceSummary(booking)

  async function submit() {
    if (!booking || !selectedDate || !slotValue) return
    setSubmitting(true)
    setError(null)
    try {
      await rescheduleBooking(booking.id, {
        date: selectedDate,
        time: slotValue,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reschedule failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={bookingStyles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={bookingStyles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BookingHeader title="Reschedule" subtitle={booking.salonName} onBack={goBack} />
        <ScrollView
          style={bookingStyles.page}
          contentContainerStyle={[bookingStyles.body, { paddingBottom: BOOKING_BAR_SPACE }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <BookingSectionLabel first>Your booking</BookingSectionLabel>
          <BookingCard style={styles.summary}>
            <PlaceRow
              imageUrl={bookingPhotoUrl(booking)}
              name={booking.salonName}
              caption={booking.salonArea || null}
              meta={services || null}
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

          <BookingSectionLabel>Pick a new day</BookingSectionLabel>
          {dayOptions.length > 0 ? (
            <View style={styles.bleed}>
              <DayStrip
                options={dayOptions}
                value={selectedDate}
                onSelect={(date) => {
                  setSlotValue(null)
                  setDateOverride(date)
                }}
              />
            </View>
          ) : slotsLoading ? (
            <View style={styles.dayGhostRow}>
              {[0, 1, 2, 3, 4].map((index) => (
                <View key={index} style={styles.dayGhost} />
              ))}
            </View>
          ) : (
            <Notice tone="grey" icon="calendar-clear-outline">
              No open days right now. Try again later.
            </Notice>
          )}

          <BookingSectionLabel>Pick a new time</BookingSectionLabel>
          <TimeGrid
            options={slots.map((slot) => ({ value: slot.value, label: slot.label }))}
            value={slotValue}
            onSelect={setSlotValue}
            loading={slotsLoading}
            emptyMessage={!selectedDate ? "Pick a day first." : slotsMessage || "No time slots for this day."}
          />

          <BookingSectionLabel>{`Note for ${who} (optional)`}</BookingSectionLabel>
          <Field
            value={note}
            onChangeText={setNote}
            placeholder="Reason for change"
            accessibilityLabel={`Note for ${who}`}
            multiline
          />

          <View style={styles.notice}>
            <Notice icon="information-circle-outline">
              {`Your current time stays booked until the ${who} confirms the new one.`}
            </Notice>
          </View>
        </ScrollView>

        <BookingBar
          title={
            selectedDate && slotValue
              ? `${formatDayChip(selectedDate)} · ${displayTime(selectedSlotLabel)}`
              : "Pick a new time"
          }
          caption={`Was ${formatBookingWhen(booking)}`}
          label="Confirm new time"
          onPress={() => void submit()}
          disabled={!selectedDate || !slotValue}
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
  dayGhostRow: { flexDirection: "row", gap: 8 },
  dayGhost: { width: 60, height: 72, borderRadius: 14, backgroundColor: "#f3f3f3" },
  notice: { marginTop: 20 },
})
