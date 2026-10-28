import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fetchWaitlist, leaveWaitlist, type WaitlistEntry } from "@/lib/waitlist-api"
import { colors, radii, spacing, status as tint } from "@/theme/tokens"

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
      <Text variant="label" muted>
        Waitlist
      </Text>
      {entries.map((entry) => {
        const opened = entry.status !== "waiting"
        return (
          <View key={entry.id} style={[styles.row, opened && { backgroundColor: tint.successBg }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${entry.providerName}, ${dayLabel(entry.date)}. ${opened ? "A slot opened. Book now." : "Waiting for a slot."}`}
              style={{ flex: 1, gap: 2 }}
              onPress={() =>
                entry.kind === "artist"
                  ? router.push({ pathname: "/artist/book/[slug]", params: { slug: entry.providerSlug } })
                  : router.push({ pathname: "/salon/[id]", params: { id: entry.providerSlug } })
              }
            >
              <Text variant="bodyStrong" numberOfLines={1}>
                {entry.providerName} · {dayLabel(entry.date)}
              </Text>
              <Text variant="caption" color={opened ? tint.successFg : colors.textMuted}>
                {opened ? "A slot opened. Tap to book." : "We'll notify you if a time frees up."}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Leave the waitlist for ${entry.providerName} on ${dayLabel(entry.date)}`}
              hitSlop={10}
              onPress={() => void leaveWaitlist(entry.id).then(setEntries).catch(() => {})}
            >
              <Icon name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
})
