import { useRouter } from "expo-router"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"

import { ThumbOrFallback } from "@/components/home/PhotoFallback"
import { SectionLabel } from "@/components/home/ServiceTiles"
import { Text } from "@/components/ui/Text"
import type { Booking } from "@/data/types"
import { serviceSummary } from "@/lib/booking-display"
import { bookingPhotoUrl } from "@/lib/booking-photo"
import { resolveSalonById } from "@/lib/salons-api"
import { formatRupees } from "@/lib/service-pricing"
import { fontFamily } from "@/theme/tokens"

/** "BOOK AGAIN": chips for past completed visits. Renders nothing when there are none. */
export function BookAgainRow({ bookings }: { bookings: Booking[] }) {
  const router = useRouter()
  if (bookings.length === 0) return null

  return (
    <View style={styles.section}>
      <View style={styles.labelPad}>
        <SectionLabel title="Book again" />
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {bookings.map((booking) => {
          const isArtist = booking.kind === "artist"
          const salon = isArtist ? undefined : resolveSalonById(booking.salonId)
          const image = bookingPhotoUrl(booking)
          const name = salon?.name ?? booking.salonName
          const detail = [serviceSummary(booking), booking.price > 0 ? formatRupees(booking.price) : null]
            .filter(Boolean)
            .join(" · ")
          const slug = booking.artistSlug
          return (
            <Pressable
              key={booking.id}
              accessibilityRole="button"
              accessibilityLabel={`Book again: ${name}, ${detail}`}
              onPress={() => {
                if (isArtist) {
                  if (slug) router.push({ pathname: "/artist/[slug]", params: { slug } })
                  return
                }
                router.push({ pathname: "/salon/[id]", params: { id: booking.salonId } })
              }}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <ThumbOrFallback uri={image} name={name} />
              <View style={styles.text}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.detail} numberOfLines={1}>
                  {detail}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
  },
  labelPad: {
    paddingHorizontal: 20,
  },
  row: {
    paddingHorizontal: 20,
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: "#ececec",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    maxWidth: 260,
  },
  pressed: {
    backgroundColor: "#f6f6f6",
  },
  text: {
    flexShrink: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: "#111111",
  },
  detail: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: "#595959",
  },
})
