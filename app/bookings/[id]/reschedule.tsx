import { useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"

import { BookingDateSheet } from "@/components/book/BookingDateSheet"
import { BookingSelectTrigger } from "@/components/book/BookingSelectTrigger"
import { BookingTimeSheet } from "@/components/book/BookingTimeSheet"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Screen } from "@/components/ui/Screen"
import { BookingsListSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import type { Booking } from "@/data/types"
import { ApiError } from "@/lib/api"
import {
  fetchAvailability,
  type AvailabilityDay,
  type AvailabilitySlot,
} from "@/lib/availability-api"
import { fetchBookingById, rescheduleBooking } from "@/lib/bookings-api"
import {
  canRescheduleWithNotice,
  getRescheduleBlockedReason,
} from "@/lib/reschedule-policy"
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
  const [dateSheetOpen, setDateSheetOpen] = useState(false)
  const [timeSheetOpen, setTimeSheetOpen] = useState(false)
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
    if (!booking || serviceIds.length === 0) return

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

  if (loading) {
    return (
      <Screen scroll>
        <BookingsListSkeleton count={1} />
      </Screen>
    )
  }

  if (!booking) {
    return (
      <Screen>
        <Text variant="heading">Booking not found</Text>
        <Button
          label="Back to bookings"
          style={{ marginTop: spacing.xl }}
          onPress={() => router.replace("/(tabs)/bookings")}
        />
      </Screen>
    )
  }

  if (!canRescheduleWithNotice(booking.startsAt).allowed) {
    return (
      <Screen>
        <Text variant="title">Reschedule unavailable</Text>
        <Text muted style={styles.gap}>
          {getRescheduleBlockedReason(booking.startsAt)}
        </Text>
        <Button
          label="Back to bookings"
          style={{ marginTop: spacing.xl }}
          onPress={() => router.replace("/(tabs)/bookings")}
        />
      </Screen>
    )
  }

  if (done) {
    return (
      <Screen>
        <Text variant="title">Reschedule requested</Text>
        <Text muted style={styles.gap}>
          The salon will confirm the new slot.
        </Text>
        <View style={styles.card}>
          <Text variant="bodyStrong">{booking.salonName}</Text>
          <Text muted>
            {selectedDate ? formatDayChip(selectedDate) : "—"} · {selectedSlotLabel}
          </Text>
        </View>
        <Button
          label="View bookings"
          style={{ marginTop: spacing.xl }}
          onPress={() => router.replace("/(tabs)/bookings")}
        />
      </Screen>
    )
  }

  const dateOptions = days.map((day) => ({
    date: day.date,
    label: formatDayChip(day.date),
    disabled: day.availableCount === 0,
  }))

  return (
    <Screen scroll>
      <Text variant="title">Reschedule</Text>
      <Text muted style={styles.gap}>
        {booking.salonName} · currently {booking.date} · {booking.time}
      </Text>

      <View style={styles.fields}>
        <BookingSelectTrigger
          label="New date"
          icon="calendar-outline"
          value={selectedDate ? formatDayChip(selectedDate) : ""}
          placeholder="Select date"
          disabled={days.length === 0}
          onPress={() => setDateSheetOpen(true)}
        />
        <BookingSelectTrigger
          label="New time"
          icon="time-outline"
          value={
            slotValue
              ? slots.find((slot) => slot.value === slotValue)?.label ?? slotValue
              : ""
          }
          placeholder={
            !selectedDate
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
            !selectedDate ||
            slotsLoading ||
            Boolean(slotsMessage) ||
            slots.length === 0
          }
          onPress={() => setTimeSheetOpen(true)}
        />
      </View>

      <View style={styles.section}>
        <Input
          label="Note for salon (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Reason for change"
        />
      </View>

      {error ? (
        <Text variant="caption" color={colors.primary} style={styles.gap}>
          {error}
        </Text>
      ) : null}

      <Button
        label="Request reschedule"
        loading={submitting}
        disabled={!selectedDate || !slotValue}
        style={{ marginTop: spacing.xl }}
        onPress={async () => {
          if (!selectedDate || !slotValue) return
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
        }}
      />

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
    </Screen>
  )
}

const styles = StyleSheet.create({
  gap: {
    marginTop: spacing.sm,
  },
  fields: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  section: {
    marginTop: spacing.xxl,
  },
  card: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
})
