import { useEffect, useRef } from "react"
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from "react-native"

import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

import { sp, ui } from "./theme"

export type SalonTabKey = "services" | "photos" | "reviews" | "about"

export const TAB_BAR_HEIGHT = 46
export const CHIP_ROW_HEIGHT = 54

const LABELS: Record<SalonTabKey, string> = {
  services: "Services",
  photos: "Photos",
  reviews: "Reviews",
  about: "About",
}

export function SalonTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: SalonTabKey[]
  active: SalonTabKey
  onSelect: (tab: SalonTabKey) => void
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

export function SalonCategoryChips({
  categories,
  active,
  onSelect,
}: {
  categories: string[]
  active: string
  onSelect: (category: string) => void
}) {
  const scrollRef = useRef<ScrollViewInstance>(null)
  const chipX = useRef<Record<string, number>>({})

  // Keep the active chip in view as scroll-spy moves it.
  useEffect(() => {
    const x = chipX.current[active]
    if (typeof x === "number") scrollRef.current?.scrollTo({ x: Math.max(0, x - 20), animated: true })
  }, [active])

  return (
    <View style={styles.chipRowWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {categories.map((category) => {
          const isActive = category === active
          return (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onLayout={(event) => {
                chipX.current[category] = event.nativeEvent.layout.x
              }}
              onPress={() => onSelect(category)}
              style={[ui.chip, isActive && ui.chipActive]}
            >
              <Text style={[ui.chipText, isActive && ui.chipTextActive]}>{category}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
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
  chipRowWrap: {
    height: CHIP_ROW_HEIGHT,
    backgroundColor: "#ffffff",
    justifyContent: "center",
  },
  chipRow: {
    gap: 8,
    paddingHorizontal: sp.gutter,
    alignItems: "center",
  },
})
