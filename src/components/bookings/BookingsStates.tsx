import { StyleSheet, View } from "react-native"

import { ActionPill } from "@/components/bookings/BookingPills"
import { GradientFill } from "@/components/home/GradientFill"
import type { Pastel } from "@/components/profile/ProfileParts"
import { pastels, sp } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { SkeletonBone } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { FILTER_LABELS } from "@/lib/booking-display"
import { fontFamily } from "@/theme/tokens"

type Filter = keyof typeof FILTER_LABELS

const EMPTY: Record<Filter, { icon: IconName; pastel: Pastel; title: string; body: string }> = {
  all: {
    icon: "calendar-outline",
    pastel: pastels.peach,
    title: "No bookings yet",
    body: "Book a salon or artist and your visits will show up here.",
  },
  upcoming: {
    icon: "calendar-outline",
    pastel: pastels.peach,
    title: "No upcoming bookings",
    body: "Your next confirmed and pending visits will appear here.",
  },
  completed: {
    icon: "checkmark-done-outline",
    pastel: pastels.mint,
    title: "No completed visits",
    body: "Finished visits land here so you can rate them or book again.",
  },
  cancelled: {
    icon: "close-circle-outline",
    pastel: pastels.sky,
    title: "No cancelled bookings",
    body: "Cancelled, declined or expired bookings show up here.",
  },
}

function StateBlock({
  icon,
  pastel,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: IconName
  pastel: Pastel
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.circle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <GradientFill colors={pastel.gradient} angle={150} />
        <Icon name={icon} size={36} color={pastel.ink} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <ActionPill label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  )
}

export function BookingsEmpty({ filter, onFind }: { filter: Filter; onFind: () => void }) {
  const copy = EMPTY[filter]
  return <StateBlock {...copy} actionLabel="Find a salon" onAction={onFind} />
}

export function BookingsSignedOut({ onSignIn }: { onSignIn: () => void }) {
  return (
    <StateBlock
      icon="person-outline"
      pastel={pastels.lavender}
      title="Log in to view your bookings"
      body="Sign in with your mobile number to see upcoming visits, past appointments and updates."
      actionLabel="Log in"
      onAction={onSignIn}
    />
  )
}

export function BookingsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <StateBlock
      icon="cloud-offline-outline"
      pastel={pastels.gold}
      title="Couldn't load bookings"
      body={message}
      actionLabel="Try again"
      onAction={onRetry}
    />
  )
}

/** Hero + two compact placeholder cards. */
export function BookingsSkeleton() {
  return (
    <View style={styles.skeleton} accessibilityLabel="Loading your bookings">
      <View style={styles.skelCard}>
        <SkeletonBone height={140} radius={0} />
        <View style={styles.skelBody}>
          <SkeletonBone width="60%" height={18} />
          <SkeletonBone width="45%" height={13} />
          <SkeletonBone width="50%" height={15} />
          <View style={styles.skelRow}>
            <SkeletonBone width={96} height={34} radius={999} />
            <SkeletonBone width={96} height={34} radius={999} />
          </View>
        </View>
      </View>
      {[0, 1].map((key) => (
        <View key={key} style={[styles.skelCard, styles.skelCompact]}>
          <SkeletonBone width={56} height={56} radius={12} />
          <View style={styles.skelText}>
            <SkeletonBone width="70%" height={15} />
            <SkeletonBone width="50%" height={12} />
            <SkeletonBone width="40%" height={12} />
          </View>
          <SkeletonBone width={72} height={22} radius={999} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: sp.text,
    textAlign: "center",
  },
  body: {
    marginTop: 6,
    maxWidth: 300,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.secondary,
    textAlign: "center",
  },
  action: {
    marginTop: 20,
  },
  skeleton: {
    gap: 12,
  },
  skelCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  skelBody: {
    padding: 16,
    gap: 10,
  },
  skelRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  skelCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  skelText: {
    flex: 1,
    gap: 6,
  },
})
