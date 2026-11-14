import { Pressable, StyleSheet, View } from "react-native"

import { sp, ui } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Booking, BookingStatus } from "@/data/types"
import { getBookingStatusLabel, isArtistBooking, visitTypeLabel } from "@/lib/booking-display"
import { fontFamily } from "@/theme/tokens"

const GREEN = { bg: sp.ratingBg, ink: sp.ratingInk }
const PEACH = { bg: sp.peachBg, ink: sp.peachInk }
const GREY = { bg: "#f2f2f2", ink: sp.secondary }
const RED = { bg: "#fdecea", ink: "#c0392b" }

function statusTone(status: BookingStatus) {
  switch (status) {
    case "confirmed":
    case "upcoming":
    case "completed":
      return GREEN
    case "pending":
      return PEACH
    case "declined":
    case "payment_failed":
      return RED
    default:
      return GREY
  }
}

export function StatusPill({ status }: { status: BookingStatus }) {
  const tone = statusTone(status)
  return (
    <View style={[styles.status, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusText, { color: tone.ink }]} numberOfLines={1}>
        {getBookingStatusLabel(status)}
      </Text>
    </View>
  )
}

/** "Artist" / "At home" / "Studio" tags, from what the booking carries. */
export function bookingTags(booking: Booking): string[] {
  const tags: string[] = []
  if (isArtistBooking(booking)) {
    tags.push("Artist")
    const visit = visitTypeLabel(booking)
    if (visit === "Home visit") tags.push("At home")
    else if (visit === "Studio visit") tags.push("Studio")
  }
  return tags
}

export function BookingTags({ booking }: { booking: Booking }) {
  const tags = bookingTags(booking)
  if (tags.length === 0) return null
  return (
    <View style={styles.tags}>
      {tags.map((tag) => (
        <View key={tag} style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ))}
    </View>
  )
}

/** Black (primary) or outline pill button. */
export function ActionPill({
  label,
  onPress,
  outline,
  small,
  icon,
  accessibilityLabel,
}: {
  label: string
  onPress: () => void
  outline?: boolean
  small?: boolean
  icon?: IconName
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={small ? 6 : 0}
      onPress={onPress}
      style={({ pressed }) => [
        outline ? styles.outline : ui.blackPill,
        small && styles.small,
        styles.pill,
        pressed && ui.pressed,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 14 : 16} color={outline ? sp.text : "#ffffff"} /> : null}
      <Text style={[outline ? styles.outlineText : ui.blackPillText, small && styles.smallText]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  status: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  statusText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: sp.grey,
  },
  tagText: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 15,
    color: sp.secondary,
  },
  pill: {
    flexDirection: "row",
    gap: 6,
  },
  outline: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: sp.text,
  },
  small: {
    height: 30,
    paddingHorizontal: 12,
  },
  smallText: {
    fontSize: 12,
    lineHeight: 16,
  },
})
