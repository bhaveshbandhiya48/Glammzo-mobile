import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { PastelIcon } from "@/components/profile/ProfileParts"
import { pastels, ui } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fetchWaitlist, leaveWaitlist, type WaitlistEntry } from "@/lib/waitlist-api"
import { fontFamily } from "@/theme/tokens"

function dayLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

/** Days you're waiting on, above the bookings list. Hidden when empty. */
export function WaitlistStrip() {
  const router = useRouter()
  const [entries, setEntries] = useState<WaitlistEntry[]>([])

  useFocusEffect(
    useCallback(() => {
      let active = true
      void fetchWaitlist()
        .then((next) => active && setEntries(next))
        .catch(() => {})
      return () => {
        active = false
      }
    }, []),
  )

  if (entries.length === 0) return null

  return (
    <View style={styles.wrap}>
      <Text style={ui.sectionLabel} accessibilityRole="header">
        Waitlist
      </Text>
      {entries.map((entry) => {
        const opened = entry.status !== "waiting"
        const pastel = opened ? pastels.mint : pastels.sky
        return (
          <View key={entry.id} style={[styles.row, opened && styles.rowOpened]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${entry.providerName}, ${dayLabel(entry.date)}. ${opened ? "A slot opened. Book now." : "Waiting for a slot."}`}
              style={({ pressed }) => [styles.main, pressed && ui.pressed]}
              onPress={() =>
                entry.kind === "artist"
                  ? router.push({ pathname: "/artist/book/[slug]", params: { slug: entry.providerSlug } })
                  : router.push({ pathname: "/salon/[id]", params: { id: entry.providerSlug } })
              }
            >
              <PastelIcon pastel={pastel} name={opened ? "notifications" : "hourglass-outline"} />
              <View style={styles.copy}>
                <Text style={styles.title} numberOfLines={1}>
                  {entry.providerName} · {dayLabel(entry.date)}
                </Text>
                <Text style={[styles.caption, opened && styles.captionOpened]}>
                  {opened ? "A slot opened. Tap to book." : "We'll notify you if a time frees up."}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Leave the waitlist for ${entry.providerName} on ${dayLabel(entry.date)}`}
              hitSlop={10}
              style={({ pressed }) => [styles.close, pressed && ui.pressed]}
              onPress={() => void leaveWaitlist(entry.id).then(setEntries).catch(() => {})}
            >
              <Icon name="close" size={16} color="#595959" />
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginTop: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e3e3e3",
  },
  rowOpened: {
    borderColor: "#bfe3cc",
    backgroundColor: "#f3faf5",
  },
  main: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: "#111111",
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
  },
  captionOpened: {
    fontFamily: fontFamily.medium,
    color: "#17633e",
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f3f3",
    alignItems: "center",
    justifyContent: "center",
  },
})
