import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs"
import { useEffect, useRef } from "react"
import { Animated, Pressable, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Text } from "@/components/ui/Text"
import { colors, radii, spacing } from "@/theme/tokens"

const BAR_HEIGHT = 52

/** Gap under the bar: close to the screen edge, just clear of the iPhone home indicator. */
function barBottomGap(insetBottom: number) {
  return Math.max(Math.round(insetBottom * 0.5), spacing.sm)
}

/** Bottom space a tab screen should leave so its last content scrolls clear of the floating bar. */
export function useFloatingTabBarSpace() {
  const insets = useSafeAreaInsets()
  return BAR_HEIGHT + barBottomGap(insets.bottom) + spacing.md
}

/**
 * Bottom navigation as a separate rounded bar floating above the screen edge
 * (Instagram-style). The selected tab gets a black pill with its label.
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  // "index" only redirects to Home; it has no tab.
  const routes = state.routes.filter((route) => route.name !== "index")
  // A screen can hide the bar, like Home does while its map is open.
  const focusedKey = state.routes[state.index]?.key
  const focusedOptions = focusedKey ? descriptors[focusedKey]?.options : undefined
  if (StyleSheet.flatten(focusedOptions?.tabBarStyle)?.display === "none") return null

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: barBottomGap(insets.bottom) }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {routes.map((route) => {
          const index = state.routes.indexOf(route)
          const focused = state.index === index
          const { options } = descriptors[route.key]!
          const label = typeof options.title === "string" ? options.title : route.name
          return (
            <Tab
              key={route.key}
              label={label}
              focused={focused}
              icon={options.tabBarIcon?.({ focused, color: focused ? colors.primaryFg : colors.text, size: 20 })}
              onPress={() => {
                const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true })
                if (!focused && !event.defaultPrevented) navigateToTab(route.key)
              }}
              onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
            />
          )
        })}
      </View>
    </View>
  )
}

function Tab({
  label,
  focused,
  icon,
  onPress,
  onLongPress,
}: {
  label: string
  focused: boolean
  icon: React.ReactNode
  onPress: () => void
  onLongPress: () => void
}) {
  const grow = useRef(new Animated.Value(focused ? 1 : 0)).current
  useEffect(() => {
    Animated.spring(grow, { toValue: focused ? 1 : 0, damping: 18, stiffness: 220, useNativeDriver: false }).start()
  }, [focused, grow])

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabHit}
    >
      <Animated.View
        style={[
          styles.tab,
          {
            backgroundColor: grow.interpolate({ inputRange: [0, 1], outputRange: ["rgba(17,17,17,0)", colors.primary] }),
            paddingHorizontal: grow.interpolate({ inputRange: [0, 1], outputRange: [spacing.sm, spacing.md] }),
          },
        ]}
      >
        {icon}
        {focused ? (
          <Text variant="caption" color={colors.primaryFg} style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Floats over the screen: no strip behind the bar.
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    height: BAR_HEIGHT,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  tabHit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    borderRadius: radii.pill,
  },
  label: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
  },
})
