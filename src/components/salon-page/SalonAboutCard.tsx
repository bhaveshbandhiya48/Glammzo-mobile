import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

import { sp, ui } from "./theme"

export type AboutRow = {
  key: string
  icon: IconName
  title: string
  subtitle?: string | null
  action?: { label: string; onPress: () => void }
}

export function SalonAboutCard({
  rows,
  amenities,
}: {
  rows: AboutRow[]
  amenities: { id: string; label: string; icon: string }[]
}) {
  const [allAmenities, setAllAmenities] = useState(false)
  const shown = allAmenities ? amenities : amenities.slice(0, 6)

  return (
    <View style={styles.wrap}>
      {rows.length > 0 ? (
        <View style={styles.card}>
          {rows.map((row, index) => (
            <View key={row.key} style={[styles.row, index > 0 && styles.divider]}>
              <View style={styles.iconBox}>
                <Icon name={row.icon} size={18} color={sp.text} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.title} numberOfLines={2}>
                  {row.title}
                </Text>
                {row.subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={2}>
                    {row.subtitle}
                  </Text>
                ) : null}
              </View>
              {row.action ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${row.action.label}: ${row.title}`}
                  hitSlop={6}
                  onPress={row.action.onPress}
                  style={({ pressed }) => [ui.blackPill, pressed && ui.pressed]}
                >
                  <Text style={ui.blackPillText}>{row.action.label}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {amenities.length > 0 ? (
        <View style={styles.amenities}>
          {shown.map((row) => (
            <View key={row.id} style={styles.amenity}>
              <Icon name={row.icon} size={15} color={sp.text} />
              <Text style={styles.amenityText}>{row.label}</Text>
            </View>
          ))}
          {amenities.length > 6 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setAllAmenities((open) => !open)}
              style={[styles.amenity, styles.amenityMore]}
            >
              <Text style={styles.amenityText}>{allAmenities ? "Show less" : `+${amenities.length - 6} more`}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: sp.gutter,
    gap: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: sp.tabBorder,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: "#ffffff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: sp.hairline,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: sp.grey,
    alignItems: "center",
    justifyContent: "center",
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
    color: sp.text,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: sp.secondary,
  },
  amenities: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  amenity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: sp.grey,
    borderWidth: 1,
    borderColor: sp.grey,
  },
  amenityMore: {
    backgroundColor: "#ffffff",
    borderColor: sp.border,
  },
  amenityText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 17,
    color: sp.text,
  },
})
