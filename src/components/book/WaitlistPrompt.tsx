import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"

import { PastelIcon } from "@/components/profile/ProfileParts"
import { pastels, ui } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { joinWaitlist } from "@/lib/waitlist-api"
import { fontFamily } from "@/theme/tokens"

function formatDayChip(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

type Props = {
  kind: "salon" | "artist"
  /** Salon slug/id or artist slug. */
  provider: string
  date: string
  serviceIds: string[]
}

/** Shown when a day has no free times: "Tell me if a slot opens". */
export function WaitlistPrompt({ kind, provider, date, serviceIds }: Props) {
  const [joined, setJoined] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setJoined(false)
    setError(null)
  }, [date, provider])

  const day = formatDayChip(date)

  if (joined) {
    return (
      <View style={[styles.card, styles.joined]} accessibilityLiveRegion="polite">
        <Icon name="checkmark-circle" size={20} color="#17633e" />
        <Text style={styles.joinedText}>
          You&apos;re on the waitlist for {day}. We&apos;ll send a notification if a time frees up.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <PastelIcon pastel={pastels.lavender} name="notifications-outline" />
      <View style={styles.copy}>
        <Text style={styles.title}>{day} is fully booked</Text>
        <Text style={styles.sub}>Pick another day, or we can tell you if someone cancels.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: busy }}
        disabled={busy}
        style={({ pressed }) => [styles.button, pressed && ui.pressed]}
        accessibilityLabel={`Notify me if a slot opens on ${day}`}
        onPress={async () => {
          setBusy(true)
          setError(null)
          try {
            await joinWaitlist({ kind, provider, date, serviceIds })
            setJoined(true)
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't add you to the waitlist.")
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? <ActivityIndicator color="#111111" size="small" /> : <Text style={styles.buttonText}>Notify me</Text>}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    backgroundColor: "#ffffff",
  },
  joined: { backgroundColor: "#e6f5ec", borderColor: "#e6f5ec" },
  joinedText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: "#17633e" },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 19, color: "#111111" },
  sub: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: "#595959" },
  error: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 17, color: "#c0392b" },
  button: {
    height: 36,
    minWidth: 92,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#111111",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 17, color: "#111111" },
})
