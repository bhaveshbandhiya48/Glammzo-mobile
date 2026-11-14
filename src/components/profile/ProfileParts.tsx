import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import { sp, ui } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

export type Pastel = { gradient: [string, string] | string[]; ink: string }

/** Rounded pastel square with an icon (rows use 36/10, tiles use 32/10). */
export function PastelIcon({ pastel, name, size = 36 }: { pastel: Pastel; name: IconName; size?: number }) {
  return (
    <View style={[styles.chip, { width: size, height: size }]}>
      <GradientFill colors={pastel.gradient} angle={150} />
      <Icon name={name} size={Math.round(size * 0.5)} color={pastel.ink} />
    </View>
  )
}

/** Small white card for the wallet / stamps / saved row. */
export function StatTile({
  pastel,
  icon,
  value,
  label,
  accessibilityLabel,
  onPress,
  children,
}: {
  pastel: Pastel
  icon: IconName
  value: string
  label: string
  accessibilityLabel: string
  onPress: () => void
  children?: ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && ui.pressed]}
    >
      <PastelIcon pastel={pastel} name={icon} size={32} />
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      {children}
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

export type ProfileRowProps = {
  label: string
  icon: IconName
  pastel: Pastel
  value?: string | null
  badge?: string | null
  external?: boolean
  hint?: string
  onPress: () => void
}

export function ProfileGroup({ title, rows }: { title: string; rows: ProfileRowProps[] }) {
  return (
    <View style={styles.group}>
      <Text style={[ui.sectionLabel, styles.groupLabel]}>{title}</Text>
      <View style={styles.card}>
        {rows.map((row, index) => (
          <Pressable
            key={row.label}
            accessibilityRole={row.external ? "link" : "button"}
            accessibilityLabel={[row.label, row.value, row.badge].filter(Boolean).join(", ")}
            accessibilityHint={row.hint ?? (row.external ? "Opens in your browser" : undefined)}
            onPress={row.onPress}
            style={({ pressed }) => [styles.row, pressed && ui.pressed]}
          >
            {index > 0 ? <View style={styles.hairline} /> : null}
            <PastelIcon pastel={row.pastel} name={row.icon} />
            <Text style={styles.rowLabel} numberOfLines={1}>
              {row.label}
            </Text>
            {row.badge ? (
              <View style={ui.offerBadge}>
                <Text style={ui.offerBadgeText}>{row.badge}</Text>
              </View>
            ) : row.value ? (
              <Text style={styles.rowValue} numberOfLines={1}>
                {row.value}
              </Text>
            ) : null}
            <Icon name={row.external ? "open-outline" : "chevron-forward"} size={18} color={sp.secondary} />
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  tile: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
  },
  tileValue: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 22,
    color: sp.text,
    marginTop: 4,
  },
  tileLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: sp.secondary,
  },
  group: {
    marginTop: 24,
  },
  groupLabel: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: 62,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: sp.border,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
    color: sp.text,
  },
  rowValue: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 18,
    color: sp.secondary,
    maxWidth: 120,
  },
})
