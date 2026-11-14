import { Pressable, StyleSheet, View } from "react-native"

import { TAB_BAR_HEIGHT } from "@/components/salon-page/SalonTabs"
import { sp } from "@/components/salon-page/theme"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

export type ArtistTabKey = "services" | "portfolio" | "reviews" | "about"

export { TAB_BAR_HEIGHT }

const LABELS: Record<ArtistTabKey, string> = {
  services: "Services",
  portfolio: "Portfolio",
  reviews: "Reviews",
  about: "About",
}

/** Same underline tab bar as the salon page, with artist section names. */
export function ArtistTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: ArtistTabKey[]
  active: ArtistTabKey
  onSelect: (tab: ArtistTabKey) => void
}) {
  return (
    <View style={styles.tabBar} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isActive = tab === active
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(tab)}
            style={styles.tab}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{LABELS[tab]}</Text>
            <View style={[styles.underline, isActive && styles.underlineActive]} />
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    gap: 22,
    paddingHorizontal: sp.gutter,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: sp.tabBorder,
  },
  tab: {
    justifyContent: "flex-end",
  },
  tabText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 18,
    color: sp.label,
    paddingBottom: 11,
  },
  tabTextActive: {
    fontFamily: fontFamily.bold,
    color: sp.text,
  },
  underline: {
    height: 2,
    marginBottom: -1,
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  underlineActive: {
    backgroundColor: sp.text,
  },
})
