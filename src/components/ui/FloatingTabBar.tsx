import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs"
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import {
  Animated,
  Easing,
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

/** Full↔mini switch: ease-out, no overshoot, transforms and opacity only (native driver). */
const MORPH_MS = 240
/** Scroll this far in one direction before the bar switches. */
const SWITCH_DISTANCE = 28
/** Near the top the full bar always shows. */
const TOP_ZONE = 40

// Collapsed state shared between the bar and the screen that scrolls.
let collapsed = false
/** No new switch until the running full↔mini animation has finished. */
let lockedUntil = 0
const listeners = new Set<() => void>()

/** Shrink (true) or restore (false) the floating tab bar. */
export function setTabBarCollapsed(next: boolean) {
  if (collapsed === next) return
  collapsed = next
  lockedUntil = Date.now() + MORPH_MS
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
 * Scrolling down shrinks the bar; scrolling back up brings it back. It only switches after
 * ~28pt of steady movement one way, ignores iOS bounce past either end, and keeps the full
 * bar near the top. Nothing here re-renders the screen: state changes only when the mode does.
 */
export function useCollapseTabBarOnScroll() {
  const lastY = useRef(0)
  const travel = useRef(0)
  // Leaving the screen always restores the full bar.
  useEffect(() => () => setTabBarCollapsed(false), [])
  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const maxY = Math.max(0, contentSize.height - layoutMeasurement.height)
    const y = contentOffset.y
    if (y < TOP_ZONE) {
      // Includes the pull-to-refresh / top bounce (negative offsets).
      lastY.current = Math.max(y, 0)
      travel.current = 0
      setTabBarCollapsed(false)
      return
    }
    if (y > maxY) {
      // Bottom bounce: the rubber band springing back is not the user scrolling up.
      lastY.current = maxY
      travel.current = 0
      return
    }
    const dy = y - lastY.current
    lastY.current = y
    if (dy === 0) return
    // Count distance in one direction; turning around starts the count again.
    travel.current = Math.sign(dy) === Math.sign(travel.current) ? travel.current + dy : dy
    if (Date.now() < lockedUntil) return
    if (travel.current >= SWITCH_DISTANCE && !collapsed) {
      travel.current = 0
      setTabBarCollapsed(true)
    } else if (travel.current <= -SWITCH_DISTANCE && collapsed) {
      travel.current = 0
      setTabBarCollapsed(false)
    }
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
 *
 * The outer frame never changes size. The full bar and the mini bar are two fixed layers
 * that cross-fade and scale on the native driver, so the switch never triggers layout
 * and can't feed back into the screen's scroll.
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()
  const isCollapsed = useTabBarCollapsed()
  const upcomingCount = useUpcomingBookingsCount()
  const progress = useRef(new Animated.Value(collapsed ? 1 : 0)).current
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: isCollapsed ? 1 : 0,
      duration: MORPH_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
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
  const fullPill = { width: Math.min(PILL_WIDTH, fullSlot), height: PILL_HEIGHT }
  const miniPill = { width: miniSlot, height: MINI_PILL_HEIGHT }

  // Full layer fades out early and settles back slightly; the mini layer fades in late from slightly larger.
  const fullStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: "clamp" }),
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, (BAR_HEIGHT - MINI_HEIGHT) / 2] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) },
    ],
  }
  const miniStyle = {
    opacity: progress.interpolate({ inputRange: [0.3, 1], outputRange: [0, 1], extrapolate: "clamp" }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] }) }],
  }

  const renderTabs = (mini: boolean) =>
    routes.map((route) => {
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
          mini={mini}
          pill={mini ? miniPill : fullPill}
          icon={options.tabBarIcon?.({ focused, color: focused ? ACTIVE_ICON : INACTIVE, size: ICON_SIZE })}
          onPress={() => {
            const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true })
            if (!focused && !event.defaultPrevented) navigateToTab(route.key)
          }}
          onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
        />
      )
    })

  // Only the visible layer takes touches and is read by screen readers.
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: barBottomGap(insets.bottom) }]}>
      <View pointerEvents="box-none" style={{ width: fullWidth, height: BAR_HEIGHT }}>
        <Animated.View
          pointerEvents={isCollapsed ? "none" : "auto"}
          {...(isCollapsed ? hidden : null)}
          style={[styles.bar, styles.fullBar, fullStyle]}
          accessibilityRole="tablist"
        >
          {renderTabs(false)}
        </Animated.View>
        <Animated.View
          pointerEvents={isCollapsed ? "auto" : "none"}
          {...(isCollapsed ? null : hidden)}
          style={[styles.bar, styles.miniBar, { left: (fullWidth - MINI_WIDTH) / 2 }, miniStyle]}
          accessibilityRole="tablist"
        >
          {/* While mini, a tap on the bar outside the icons brings back the full bar. */}
          <Pressable
            accessibilityLabel="Show full menu"
            onPress={() => setTabBarCollapsed(false)}
            style={StyleSheet.absoluteFill}
          />
          {renderTabs(true)}
        </Animated.View>
      </View>
    </View>
  )
}

function Tab({
  label,
  accessibilityLabel,
  focused,
  badge,
  mini,
  pill,
  icon,
  onPress,
  onLongPress,
}: {
  label: string
  accessibilityLabel: string
  focused: boolean
  badge: number
  mini: boolean
  pill: { width: number; height: number }
  icon: React.ReactNode
  onPress: () => void
  onLongPress: () => void
}) {
  // The selected pill fades and scales in on the tab that becomes active.
  const grow = useRef(new Animated.Value(focused ? 1 : 0)).current
  useEffect(() => {
    Animated.spring(grow, { toValue: focused ? 1 : 0, damping: 18, stiffness: 220, useNativeDriver: true }).start()
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
      <View style={[styles.iconArea, { height: pill.height }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            pill,
            {
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
      </View>
      {mini ? null : (
        <View style={styles.labelWrap}>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}
          >
            {label}
          </Text>
        </View>
      )}
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
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
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
  // Both layers sit on the same bottom edge inside the fixed frame.
  fullBar: {
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_HEIGHT,
    padding: BAR_PADDING,
  },
  miniBar: {
    bottom: 0,
    width: MINI_WIDTH,
    height: MINI_HEIGHT,
    padding: MINI_PADDING,
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
    height: LABEL_HEIGHT,
    marginTop: LABEL_GAP,
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
