import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs"
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useUpcomingBookingsCount } from "@/lib/bookings-badge"
import { fontFamily, radii, spacing } from "@/theme/tokens"

/** Full bar: floats 14pt in from each side, icon above a label per tab. */
const BAR_HEIGHT = 66
const BAR_PADDING = 6
const BAR_MARGIN = 14
const BAR_RADIUS = 26
/** Most gap kept under the bar on iPhone (same as the previous bar). */
const BAR_BOTTOM_MAX = 22
/** Mini bar while scrolling down: centred, icons only. */
const MINI_WIDTH = 168
const MINI_HEIGHT = 52
const MINI_PADDING = 5
/** Selected highlight: 52x30 behind the icon in the full bar, a 42pt pill filling its slot when mini. */
const PILL_WIDTH = 52
const PILL_HEIGHT = 30
const MINI_PILL_HEIGHT = 42
const LABEL_GAP = 3
const LABEL_HEIGHT = 16
/** Matches the 28pt icon box set in app/(tabs)/_layout.tsx around a 22pt glyph. */
const ICON_BOX = 28
const ICON_SIZE = 22

const BAR_BG = "rgba(255,255,255,0.97)"
const BAR_BORDER = "#ececec"
const ACTIVE_BG = "#fff1ec"
const ACTIVE_ICON = "#8a3524"
const ACTIVE_LABEL = "#111111"
const INACTIVE = "#4b5563"
const BADGE_BG = "#e5484d"

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
  return Math.max(Math.min(insetBottom, BAR_BOTTOM_MAX), spacing.lg)
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
 * Bottom navigation as a separate rounded bar floating above the screen edge.
 * Each tab shows its icon above a label; the selected one sits on a soft peach pill.
 * While Home scrolls down it shrinks to a centred, icons-only mini bar.
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()
  const isCollapsed = useTabBarCollapsed()
  const upcomingCount = useUpcomingBookingsCount()
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

  const tabCount = Math.max(routes.length, 1)
  const fullSlot = (fullWidth - BAR_PADDING * 2) / tabCount
  const miniSlot = (MINI_WIDTH - MINI_PADDING * 2) / tabCount
  const layout: TabLayout = {
    iconAreaHeight: progress.interpolate({ inputRange: [0, 1], outputRange: [PILL_HEIGHT, MINI_PILL_HEIGHT] }),
    pillWidth: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [Math.min(PILL_WIDTH, fullSlot), miniSlot],
    }),
    // Labels fade out early in the shrink, then their space folds away.
    labelOpacity: progress.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: "clamp" }),
    labelHeight: progress.interpolate({ inputRange: [0, 1], outputRange: [LABEL_HEIGHT, 0] }),
    labelGap: progress.interpolate({ inputRange: [0, 1], outputRange: [LABEL_GAP, 0] }),
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: barBottomGap(insets.bottom) }]}>
      <Animated.View
        style={[
          styles.bar,
          {
            width: progress.interpolate({ inputRange: [0, 1], outputRange: [fullWidth, MINI_WIDTH] }),
            height: progress.interpolate({ inputRange: [0, 1], outputRange: [BAR_HEIGHT, MINI_HEIGHT] }),
            padding: progress.interpolate({ inputRange: [0, 1], outputRange: [BAR_PADDING, MINI_PADDING] }),
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
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : typeof options.title === "string"
                ? options.title
                : route.name
          // Signed out the shared bookings list is empty, so the count is 0 and the badge hides.
          const badge = route.name === "bookings" && !focused && upcomingCount > 0 ? upcomingCount : 0
          return (
            <Tab
              key={route.key}
              label={label}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              focused={focused}
              badge={badge}
              layout={layout}
              icon={options.tabBarIcon?.({ focused, color: focused ? ACTIVE_ICON : INACTIVE, size: ICON_SIZE })}
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

type TabLayout = {
  iconAreaHeight: Animated.AnimatedInterpolation<number>
  pillWidth: Animated.AnimatedInterpolation<number>
  labelOpacity: Animated.AnimatedInterpolation<number>
  labelHeight: Animated.AnimatedInterpolation<number>
  labelGap: Animated.AnimatedInterpolation<number>
}

function Tab({
  label,
  accessibilityLabel,
  focused,
  badge,
  icon,
  layout,
  onPress,
  onLongPress,
}: {
  label: string
  accessibilityLabel: string
  focused: boolean
  badge: number
  icon: React.ReactNode
  layout: TabLayout
  onPress: () => void
  onLongPress: () => void
}) {
  // The selected pill fades and scales in on the tab that becomes active.
  const grow = useRef(new Animated.Value(focused ? 1 : 0)).current
  useEffect(() => {
    Animated.spring(grow, { toValue: focused ? 1 : 0, damping: 18, stiffness: 220, useNativeDriver: false }).start()
  }, [focused, grow])

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={badge > 0 ? `${badge} upcoming` : undefined}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
    >
      <Animated.View style={[styles.iconArea, { height: layout.iconAreaHeight }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              width: layout.pillWidth,
              height: layout.iconAreaHeight,
              opacity: grow,
              transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            },
          ]}
        />
        <View style={styles.iconBox}>
          {icon}
          {badge > 0 ? (
            <View style={styles.badge} pointerEvents="none">
              <Text style={styles.badgeText} allowFontScaling={false}>
                {badge > 9 ? "9+" : badge}
              </Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
      <Animated.View
        style={[
          styles.labelWrap,
          { height: layout.labelHeight, marginTop: layout.labelGap, opacity: layout.labelOpacity },
        ]}
      >
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}
        >
          {label}
        </Text>
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
    padding: BAR_PADDING,
    borderRadius: BAR_RADIUS,
    backgroundColor: BAR_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BAR_BORDER,
    // Warm, soft lift.
    shadowColor: "#784632",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconArea: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    position: "absolute",
    borderRadius: radii.pill,
    backgroundColor: ACTIVE_BG,
  },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    alignItems: "center",
    justifyContent: "center",
  },
  // Top -3 / right -6 of the 22pt glyph, which sits 3pt inside the 28pt icon box.
  badge: {
    position: "absolute",
    top: -3 + (ICON_BOX - ICON_SIZE) / 2,
    right: -6 + (ICON_BOX - ICON_SIZE) / 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: BADGE_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    lineHeight: 12,
    fontFamily: fontFamily.bold,
  },
  labelWrap: {
    overflow: "hidden",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    lineHeight: LABEL_HEIGHT,
  },
  labelActive: {
    color: ACTIVE_LABEL,
    fontFamily: fontFamily.bold,
  },
  labelInactive: {
    color: INACTIVE,
    fontFamily: fontFamily.medium,
  },
})
