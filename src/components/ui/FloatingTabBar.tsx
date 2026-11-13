import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs"
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { colors, radii, spacing } from "@/theme/tokens"

// Instagram's measurements: 59pt bar, 5pt inset, 22pt from the sides and bottom.
const BAR_HEIGHT = 58
/** Same inset all round, so the selected pill sits evenly inside the bar. */
const BAR_INSET = 5
const BAR_MARGIN = 22
/** Mini bar while scrolling down: smaller, centred, icons only. */
const MINI_WIDTH = 180
const MINI_HEIGHT = 50
const MINI_ICON_SCALE = 20 / 22

// Collapsed state shared between the bar and the screen that scrolls.
let collapsed = false
const listeners = new Set<() => void>()

/** Shrink (true) or restore (false) the floating tab bar. */
export function setTabBarCollapsed(next: boolean) {
  if (collapsed === next) return
  collapsed = next
  for (const listener of listeners) listener()
}

function subscribeCollapsed(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function useTabBarCollapsed() {
  return useSyncExternalStore(subscribeCollapsed, () => collapsed, () => false)
}

/**
 * Pass the result to a tab screen's ScrollView `onScroll` (with `scrollEventThrottle={16}`).
 * Scrolling down shrinks the bar; scrolling up a little or reaching the top brings it back.
 */
export function useCollapseTabBarOnScroll() {
  const lastY = useRef(0)
  // Leaving the screen always restores the full bar.
  useEffect(() => () => setTabBarCollapsed(false), [])
  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y
    const dy = y - lastY.current
    lastY.current = y
    if (y <= 24) setTabBarCollapsed(false)
    else if (dy > 6) setTabBarCollapsed(true)
    else if (dy < -12) setTabBarCollapsed(false)
  }, [])
}

/**
 * Gap under the bar: close to the screen edge, just clear of the iPhone home indicator.
 * On Android the bar must sit fully above the phone's own navigation bar (on-screen
 * Back/Home/Recents buttons can be ~48pt tall), so it clears the whole inset there.
 */
function barBottomGap(insetBottom: number) {
  if (Platform.OS === "android") return Math.max(insetBottom + spacing.sm, spacing.lg)
  return Math.max(Math.min(insetBottom, BAR_MARGIN), spacing.lg)
}

/** Height from the screen's bottom edge to the top of the floating bar. */
export function useFloatingTabBarTop() {
  const insets = useSafeAreaInsets()
  return BAR_HEIGHT + barBottomGap(insets.bottom)
}

/** Bottom space a tab screen should leave so its last content scrolls clear of the floating bar. */
export function useFloatingTabBarSpace() {
  const insets = useSafeAreaInsets()
  return BAR_HEIGHT + barBottomGap(insets.bottom) + spacing.md
}

/**
 * Bottom navigation as a separate rounded bar floating above the screen edge
 * (Instagram-style). The selected tab gets a black pill; screen readers still hear each label.
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()
  const isCollapsed = useTabBarCollapsed()
  const progress = useRef(new Animated.Value(collapsed ? 1 : 0)).current
  useEffect(() => {
    Animated.spring(progress, {
      toValue: isCollapsed ? 1 : 0,
      damping: 20,
      stiffness: 260,
      useNativeDriver: false,
    }).start()
  }, [isCollapsed, progress])
  // Switching tab shows the full bar again.
  useEffect(() => {
    setTabBarCollapsed(false)
  }, [state.index])
  const fullWidth = Math.max(MINI_WIDTH, screenWidth - BAR_MARGIN * 2)
  // "index" only redirects to Home; it has no tab.
  const routes = state.routes.filter((route) => route.name !== "index")
  // A screen can hide the bar, like Home does while its map is open.
  const focusedKey = state.routes[state.index]?.key
  const focusedOptions = focusedKey ? descriptors[focusedKey]?.options : undefined
  if (StyleSheet.flatten(focusedOptions?.tabBarStyle)?.display === "none") return null

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: barBottomGap(insets.bottom) }]}>
      <Animated.View
        style={[
          styles.bar,
          {
            width: progress.interpolate({ inputRange: [0, 1], outputRange: [fullWidth, MINI_WIDTH] }),
            height: progress.interpolate({ inputRange: [0, 1], outputRange: [BAR_HEIGHT, MINI_HEIGHT] }),
          },
        ]}
        accessibilityRole="tablist"
      >
        {/* While mini, a tap on the bar outside the icons brings back the full bar. */}
        {isCollapsed ? (
          <Pressable
            accessibilityLabel="Show full menu"
            onPress={() => setTabBarCollapsed(false)}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
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
              iconScale={progress.interpolate({ inputRange: [0, 1], outputRange: [1, MINI_ICON_SCALE] })}
              icon={options.tabBarIcon?.({ focused, color: focused ? colors.primaryFg : colors.text, size: 22 })}
              onPress={() => {
                const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true })
                if (!focused && !event.defaultPrevented) navigateToTab(route.key)
              }}
              onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
            />
          )
        })}
      </Animated.View>
    </View>
  )
}

function Tab({
  label,
  focused,
  icon,
  iconScale,
  onPress,
  onLongPress,
}: {
  label: string
  focused: boolean
  icon: React.ReactNode
  iconScale: Animated.AnimatedInterpolation<number>
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
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: iconScale }] }}>{icon}</Animated.View>
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
    paddingHorizontal: BAR_MARGIN,
    alignItems: "center",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    height: BAR_HEIGHT,
    padding: BAR_INSET,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    // Clean, minimal lift: a soft close shadow instead of a wide grey haze.
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabHit: {
    flex: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
})
