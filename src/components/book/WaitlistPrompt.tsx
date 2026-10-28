import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { joinWaitlist } from "@/lib/waitlist-api"
import { colors, radii, spacing, status as tint } from "@/theme/tokens"

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
      <View style={[styles.card, { backgroundColor: tint.successBg }]} accessibilityLiveRegion="polite">
        <Icon name="notifications-outline" size={18} color={tint.successFg} />
        <Text variant="caption" style={{ flex: 1 }} color={tint.successFg}>
          You&apos;re on the waitlist for {day}. We&apos;ll send a notification if a time frees up.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{day} is fully booked</Text>
        <Text variant="caption" muted>
          Pick another day, or we can tell you if someone cancels.
        </Text>
        {error ? (
          <Text variant="caption" color={colors.destructive}>
            {error}
          </Text>
        ) : null}
      </View>
      <Button
        label="Notify me"
        variant="secondary"
        loading={busy}
        style={styles.button}
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
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  button: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
})
