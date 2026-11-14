import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { sp } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { LeadStatus } from "@/lib/leads-api"
import { fontFamily } from "@/theme/tokens"

/** Plain white header: round back button, title, optional right action. */
export function RequestsHeader({
  title,
  onBack,
  right,
}: {
  title: string
  onBack: () => void
  right?: ReactNode
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={6}
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.85 }]}
      >
        <Icon name="chevron-back" size={20} color={sp.text} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  )
}

const STATUS_STYLE: Record<LeadStatus, { label: string; bg: string; ink: string }> = {
  open: { label: "Open", bg: sp.ratingBg, ink: sp.ratingInk },
  closed: { label: "Closed", bg: sp.grey, ink: sp.secondary },
  expired: { label: "Expired", bg: sp.grey, ink: sp.secondary },
}

export function StatusPill({ status }: { status: LeadStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.pillText, { color: s.ink }]}>{s.label}</Text>
    </View>
  )
}

export function Pill({ label, bg, ink }: { label: string; bg: string; ink: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: ink }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: sp.gutter,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: sp.hairline,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 22,
    color: sp.text,
  },
  headerRight: {
    minWidth: 38,
    alignItems: "flex-end",
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
  },
})
