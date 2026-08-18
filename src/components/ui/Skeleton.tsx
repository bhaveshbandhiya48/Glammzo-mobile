import { useEffect, useRef, type ReactNode } from "react"
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

import { colors, radii, spacing } from "@/theme/tokens"

type BoneProps = {
  width?: number | `${number}%`
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

/** Single pulsing placeholder block. */
export function SkeletonBone({
  width = "100%",
  height = 14,
  radius = radii.sm,
  style,
}: BoneProps) {
  const opacity = useRef(new Animated.Value(0.45)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[
        styles.bone,
        {
          width,
          height,
          borderRadius: radius,
          opacity,
        },
        style,
      ]}
    />
  )
}

export function SkeletonColumn({
  children,
  gap = spacing.md,
  style,
}: {
  children: ReactNode
  gap?: number
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[{ gap }, style]}>{children}</View>
}

/** Explore / home salon grid placeholder. */
export function ExploreSalonsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.salonGrid}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.salonCard}>
          <SkeletonBone height={120} radius={0} />
          <View style={styles.salonBody}>
            <SkeletonBone width="78%" height={14} />
            <SkeletonBone width="55%" height={12} />
            <SkeletonBone width="40%" height={12} />
            <SkeletonBone width="35%" height={14} />
          </View>
        </View>
      ))}
    </View>
  )
}

/** Booking list card placeholders (matches appointment card layout). */
export function BookingsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonColumn gap={spacing.md} style={{ marginTop: spacing.xl }}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.bookingCard}>
          <View style={styles.bookingHeader}>
            <View style={{ flex: 1, gap: spacing.sm }}>
              <View style={styles.row}>
                <SkeletonBone width="55%" height={16} />
                <SkeletonBone width={88} height={26} radius={radii.pill} />
              </View>
              <SkeletonBone width="40%" height={12} />
            </View>
            <SkeletonBone width={32} height={32} radius={radii.pill} />
          </View>
          <View style={styles.metaGrid}>
            {Array.from({ length: 4 }).map((__, chip) => (
              <SkeletonBone key={chip} height={58} radius={radii.md} style={styles.metaChip} />
            ))}
          </View>
          <View style={styles.bookingFooter}>
            <SkeletonBone width="45%" height={12} />
            <SkeletonBone width={56} height={16} />
          </View>
        </View>
      ))}
    </SkeletonColumn>
  )
}

/** Salon detail page placeholder. */
export function SalonDetailSkeleton() {
  return (
    <View style={styles.detailRoot}>
      <SkeletonBone height={280} radius={0} />
      <View style={styles.detailBody}>
        <SkeletonBone width="70%" height={24} />
        <SkeletonBone width="45%" height={14} />
        <SkeletonBone width="90%" height={12} />
        <SkeletonBone width="80%" height={12} />
        <View style={[styles.row, { marginTop: spacing.lg, gap: spacing.sm }]}>
          <SkeletonBone width={72} height={32} radius={radii.pill} />
          <SkeletonBone width={72} height={32} radius={radii.pill} />
          <SkeletonBone width={72} height={32} radius={radii.pill} />
        </View>
        <SkeletonColumn gap={spacing.md} style={{ marginTop: spacing.xxl }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <View key={index} style={styles.serviceRow}>
              <SkeletonBone width={56} height={56} radius={radii.md} />
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonBone width="70%" height={14} />
                <SkeletonBone width="40%" height={12} />
              </View>
              <SkeletonBone width={64} height={32} radius={radii.pill} />
            </View>
          ))}
        </SkeletonColumn>
      </View>
    </View>
  )
}

/** Wallet / loyalty summary placeholders. */
export function ProfileBlockSkeleton() {
  return (
    <SkeletonColumn gap={spacing.xl} style={{ marginTop: spacing.xl }}>
      <SkeletonBone width="30%" height={12} />
      <SkeletonBone width="40%" height={32} />
      <SkeletonBone width="85%" height={14} />
      <View style={styles.profileCard}>
        <SkeletonBone width="50%" height={16} />
        <SkeletonBone width="90%" height={12} />
        <SkeletonBone width="70%" height={12} />
      </View>
      <View style={styles.profileCard}>
        <SkeletonBone width="40%" height={14} />
        <SkeletonBone width="100%" height={12} />
        <SkeletonBone width="80%" height={12} />
      </View>
    </SkeletonColumn>
  )
}

const styles = StyleSheet.create({
  bone: {
    backgroundColor: colors.muted,
  },
  salonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  salonCard: {
    width: "48%",
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  salonBody: {
    padding: spacing.md,
    gap: 8,
  },
  bookingCard: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  bookingHeader: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  metaChip: {
    width: "47%",
    flexGrow: 1,
    minWidth: "42%",
  },
  bookingFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  detailRoot: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  detailBody: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  profileCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
})
