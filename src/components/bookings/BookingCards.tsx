import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { BookingPayStrip } from "@/components/bookings/BookingPayStrip"
import { BookingTags, StatusPill } from "@/components/bookings/BookingPills"
import { bookingServiceLine, bookingWhenLine } from "@/components/bookings/bookingGroups"
import { PhotoOrFallback, ThumbOrFallback } from "@/components/home/PhotoFallback"
import { sp, ui } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Booking } from "@/data/types"
import {
  bookingDurationMin,
  formatDuration,
  isArtistBooking,
  relativeBookingDay,
  visitTypeLabel,
} from "@/lib/booking-display"
import { bookingPhotoUrl } from "@/lib/booking-photo"
import { formatRupees } from "@/lib/service-pricing"
import { fontFamily } from "@/theme/tokens"

type CardProps = {
  booking: Booking
  onPress: () => void
  onPaymentExpired: () => void
  /** Pills under the card (View details, Book again, Rate…). */
  actions?: ReactNode
}

function placeLine(booking: Booking) {
  const staff = !isArtistBooking(booking) ? booking.staffName?.trim() : ""
  return [booking.salonArea, visitTypeLabel(booking), staff ? `with ${staff}` : ""].filter(Boolean).join(" · ")
}

function ReviewLine({ booking }: { booking: Booking }) {
  if (!booking.hasVerifiedReview || !booking.review) return null
  return (
    <View style={styles.review}>
      <View style={styles.ratingPill}>
        <Text style={styles.ratingText}>★ {booking.review.rating.toFixed(1)}</Text>
      </View>
      <Text style={styles.reviewText} numberOfLines={1}>
        Your review{booking.review.reviewType ? ` · ${booking.review.reviewType}` : ""}
      </Text>
    </View>
  )
}

/** The next visit: big photo, date and time up front, actions as pills. */
export function BookingHeroCard({ booking, onPress, onPaymentExpired, actions }: CardProps) {
  const relative = relativeBookingDay(booking.date)
  const duration = bookingDurationMin(booking)
  const place = placeLine(booking)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${booking.salonName}, ${bookingWhenLine(booking)}. Opens booking details`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && ui.pressed]}
    >
      <View style={styles.heroPhoto}>
        <PhotoOrFallback uri={bookingPhotoUrl(booking)} name={booking.salonName} />
        <View style={styles.heroBadges}>
          <StatusPill status={booking.status} />
        </View>
        {relative ? (
          <View style={styles.relative}>
            <Text style={styles.relativeText}>{relative}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.heroBody}>
        <View style={styles.titleRow}>
          <Text style={styles.heroName} numberOfLines={2}>
            {booking.salonName}
          </Text>
          <Text style={styles.heroPrice}>{formatRupees(booking.price)}</Text>
        </View>
        <Text style={styles.services} numberOfLines={2}>
          {bookingServiceLine(booking)}
        </Text>
        <View style={styles.whenRow}>
          <Icon name="calendar-outline" size={16} color={sp.text} />
          <Text style={styles.heroWhen} numberOfLines={1}>
            {bookingWhenLine(booking)}
          </Text>
          {duration > 0 ? <Text style={styles.meta}>~{formatDuration(duration)}</Text> : null}
        </View>
        {place ? (
          <View style={styles.whenRow}>
            <Icon name="location-outline" size={16} color={sp.secondary} />
            <Text style={[styles.meta, styles.flex]} numberOfLines={1}>
              {place}
            </Text>
          </View>
        ) : null}
        <BookingTags booking={booking} />
        <BookingPayStrip booking={booking} onExpired={onPaymentExpired} />
        <ReviewLine booking={booking} />
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </Pressable>
  )
}

/** List row card: thumb, name, services, date, price, status. */
export function BookingCompactCard({ booking, onPress, onPaymentExpired, actions }: CardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${booking.salonName}, ${bookingWhenLine(booking)}, ${booking.status}. Opens booking details`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.compact, pressed && ui.pressed]}
    >
      <View style={styles.compactTop}>
        <ThumbOrFallback uri={bookingPhotoUrl(booking)} name={booking.salonName} style={styles.thumb} />
        <View style={styles.compactText}>
          <Text style={styles.compactName} numberOfLines={1}>
            {booking.salonName}
          </Text>
          <Text style={styles.services} numberOfLines={1}>
            {bookingServiceLine(booking)}
          </Text>
          <Text style={styles.compactWhen} numberOfLines={1}>
            {bookingWhenLine(booking)}
          </Text>
        </View>
        <View style={styles.compactRight}>
          <StatusPill status={booking.status} />
          <Text style={styles.compactPrice}>{formatRupees(booking.price)}</Text>
        </View>
      </View>
      <BookingTags booking={booking} />
      <BookingPayStrip booking={booking} onExpired={onPaymentExpired} />
      <ReviewLine booking={booking} />
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  flex: { flex: 1 },
  heroPhoto: {
    height: 140,
    overflow: "hidden",
  },
  heroBadges: {
    position: "absolute",
    top: 12,
    left: 12,
  },
  relative: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: sp.text,
  },
  relativeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: "#ffffff",
  },
  heroBody: {
    padding: 16,
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  heroName: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: sp.text,
  },
  heroPrice: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 24,
    color: sp.text,
  },
  services: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: sp.secondary,
  },
  whenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroWhen: {
    flexShrink: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: sp.text,
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: sp.secondary,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  compact: {
    padding: 12,
    gap: 10,
  },
  compactTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  compactText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  compactName: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: sp.text,
  },
  compactWhen: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: sp.text,
  },
  compactRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  compactPrice: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    color: sp.text,
  },
  review: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: sp.ratingBg,
  },
  ratingText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: sp.ratingInk,
  },
  reviewText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: sp.secondary,
  },
})
