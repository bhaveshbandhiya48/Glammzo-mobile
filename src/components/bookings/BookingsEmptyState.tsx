import { Image, StyleSheet, View } from "react-native"

import { Button } from "@/components/ui/Button"
import { Text } from "@/components/ui/Text"
import { FILTER_LABELS } from "@/lib/booking-display"
import { colors, radii, spacing } from "@/theme/tokens"

const BOOKINGS_MASCOT = require("../../../assets/brand/glammzo-mascot-bookings.png")

type Filter = keyof typeof FILTER_LABELS

type Props = {
  filter?: Filter
  /** Logged-out empty state with login CTA. */
  signedOut?: boolean
  onSignIn?: () => void
}

const COPY: Record<Filter, { title: string; body: string }> = {
  all: {
    title: "No appointments yet",
    body: "When you book a salon visit, it will show up here with time, stylist, and status.",
  },
  upcoming: {
    title: "Nothing upcoming",
    body: "Your next confirmed and pending visits will appear in this list.",
  },
  completed: {
    title: "No completed visits",
    body: "After you finish an appointment, it will land here so you can review it later.",
  },
  cancelled: {
    title: "No cancelled bookings",
    body: "Cancelled, declined, or expired appointments will show up in this tab.",
  },
}

const SIGNED_OUT_COPY = {
  title: "Log in to view your bookings",
  body: "Sign in with your mobile number to see upcoming visits, past appointments, and booking updates.",
}

export function BookingsEmptyState({ filter = "all", signedOut = false, onSignIn }: Props) {
  const copy = signedOut ? SIGNED_OUT_COPY : COPY[filter]

  return (
    <View style={styles.wrap}>
      <Image
        source={BOOKINGS_MASCOT}
        style={styles.mascot}
        resizeMode="contain"
        accessibilityLabel="Glammzo mascot"
      />

      <Text variant="heading" style={styles.title}>
        {copy.title}
      </Text>
      <Text muted style={styles.body}>
        {copy.body}
      </Text>

      {signedOut && onSignIn ? (
        <View style={styles.actions}>
          <Button label="Log in" onPress={onSignIn} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  mascot: {
    width: 168,
    height: 168,
    marginBottom: spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  body: {
    textAlign: "center",
    maxWidth: 300,
  },
  actions: {
    width: "100%",
    maxWidth: 280,
    marginTop: spacing.xl,
  },
})
