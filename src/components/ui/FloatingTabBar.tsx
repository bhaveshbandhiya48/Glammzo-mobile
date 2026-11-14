import { useRoute } from "expo-router"
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs"
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import {
  AccessibilityInfo,
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

/** Opaque: the bar is drawn from overlapping pieces. */
const BAR_BG = "#ffffff"
const BAR_BORDER = "#ececec"
const ACTIVE_BG = "#fff1ec"
const ACTIVE_ICON = "#8a3524"
const ACTIVE_LABEL = "#111111"
const INACTIVE = "#4b5563"
const BADGE_BG = "#e5484d"

/** Full↔mini morph: ease-out, no overshoot, transforms and opacity only (native driver). */
const MORPH_DURATION = 320
const MORPH_EASING = Easing.out(Easing.cubic)
/** With Reduce Motion on, the bar just fades out and back in at its new size. */
const REDUCED_FADE_OUT = 90
const REDUCED_FADE_IN = 130
/** No new switch for this long after one (and after a tab switch). */
const SWITCH_LOCK_MS = 240
/** Scroll this far in one direction before the bar switches. */
const SWITCH_DISTANCE = 28
/** Near the top the full bar always shows. */
const TOP_ZONE = 40

// Collapsed state per tab (route key), shared between the bar and the screens that scroll.
// The bar shows the focused tab's state, so switching tabs brings back that tab's own bar
// (full when it is at the top). Tabs that never scroll the bar have no entry: full.
const collapsedByRoute = new Map<string, boolean>()
/** No new switch until the running full↔mini animation has finished. */
let lockedUntil = 0
const listeners = new Set<() => void>()

function isRouteCollapsed(routeKey: string | undefined) {
  return routeKey ? collapsedByRoute.get(routeKey) === true : false
}

/** Shrink (true) or restore (false) the floating tab bar for one tab. */
function setTabBarCollapsed(routeKey: string, next: boolean) {
  if (isRouteCollapsed(routeKey) === next) return
  if (next) collapsedByRoute.set(routeKey, true)
  else collapsedByRoute.delete(routeKey)
  lockedUntil = Date.now() + SWITCH_LOCK_MS
  for (const listener of listeners) listener()
}

function subscribeCollapsed(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function useTabBarCollapsed(routeKey: string | undefined) {
  return useSyncExternalStore(
    subscribeCollapsed,
    () => isRouteCollapsed(routeKey),
    () => false,
  )
}

/**
 * Pass the result to a tab screen's ScrollView `onScroll` (with `scrollEventThrottle={16}`).
 * Scrolling down shrinks the bar; scrolling back up brings it back. It only switches after
 * ~28pt of steady movement one way, ignores iOS bounce past either end, and keeps the full
 * bar near the top. Nothing here re-renders the screen: state changes only when the mode does.
 */
export function useCollapseTabBarOnScroll() {
  const routeKey = useRoute().key
  const lastY = useRef(0)
  const travel = useRef(0)
  // A tab screen that unmounts forgets its state (its next mount starts at the top).
  useEffect(() => () => setTabBarCollapsed(routeKey, false), [routeKey])
  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const maxY = Math.max(0, contentSize.height - layoutMeasurement.height)
    const y = contentOffset.y
    if (y < TOP_ZONE) {
      // Includes the pull-to-refresh / top bounce (negative offsets).
      lastY.current = Math.max(y, 0)
      travel.current = 0
      setTabBarCollapsed(routeKey, false)
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
    const collapsed = isRouteCollapsed(routeKey)
    if (travel.current >= SWITCH_DISTANCE && !collapsed) {
      travel.current = 0
      setTabBarCollapsed(routeKey, true)
    } else if (travel.current <= -SWITCH_DISTANCE && collapsed) {
      travel.current = 0
      setTabBarCollapsed(routeKey, false)
    }
  }, [routeKey])
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

/** Follows the system Reduce Motion setting (read from a ref, so a change never replays the morph). */
function useReduceMotionRef() {
  const ref = useRef(false)
  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) ref.current = enabled
      })
      .catch(() => {})
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      ref.current = enabled
    })
    return () => {
      active = false
      subscription.remove()
    }
  }, [])
  return ref
}

/** Vertical centre of the icon in the full bar (icon area + label, centred in the bar). */
const FULL_ICON_Y =
  BAR_PADDING + (BAR_HEIGHT - BAR_PADDING * 2 - (PILL_HEIGHT + LABEL_GAP + LABEL_HEIGHT)) / 2 + PILL_HEIGHT / 2
/** The mini bar sits on the same bottom edge, so its centre is half its height up. */
const MINI_ICON_Y = BAR_HEIGHT - MINI_HEIGHT / 2

/**
 * Bottom navigation as a separate rounded bar floating above the screen edge.
 * Each tab shows its icon above a label; the selected one sits on a soft peach pill.
 * While a tab (Home, Bookings, Profile) scrolls down it shrinks to a centred, icons-only mini bar.
 *
 * The outer frame never changes size, so the switch never triggers layout and can't feed back
 * into the screen's scroll. One progress value (0 full → 1 mini) drives everything on the
 * native driver, transforms and opacity only:
 * - the background is cut into four fixed corner quarters (they only move), four edge strips
 *   (they only stretch along their length) and a centre (stretches both ways), so the corners
 *   stay perfectly round and the hairline border never thickens at any point of the morph;
 * - each tab's icon (with its badge) slides to its spot in the mini bar, and labels fade out
 *   and drop a few pt in the first half;
 * - touches go to separate, untransformed tap layers that switch when the morph finishes.
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()
  // A screen can hide the bar, like Home does while its map is open.
  const focusedKey = state.routes[state.index]?.key
  const isCollapsed = useTabBarCollapsed(focusedKey)
  const upcomingCount = useUpcomingBookingsCount()
  const reduceMotion = useReduceMotionRef()
  const progress = useRef(new Animated.Value(isCollapsed ? 1 : 0)).current
  const fade = useRef(new Animated.Value(1)).current
  // Which tap layer takes touches: switches once the morph has finished.
  const [touchCollapsed, setTouchCollapsed] = useState(isCollapsed)
  useEffect(() => {
    const toValue = isCollapsed ? 1 : 0
    // Native timings start from the value's current native position, so reversing mid-morph is seamless.
    const animation = reduceMotion.current
      ? Animated.sequence([
          Animated.timing(fade, { toValue: 0, duration: REDUCED_FADE_OUT, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(progress, { toValue, duration: 0, useNativeDriver: true }),
          Animated.timing(fade, { toValue: 1, duration: REDUCED_FADE_IN, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ])
      : Animated.parallel([
          Animated.timing(progress, { toValue, duration: MORPH_DURATION, easing: MORPH_EASING, useNativeDriver: true }),
          // Recovers if Reduce Motion was switched off halfway through a fade.
          Animated.timing(fade, { toValue: 1, duration: REDUCED_FADE_IN, useNativeDriver: true }),
        ])
    animation.start(({ finished }) => {
      if (finished) setTouchCollapsed(isCollapsed)
    })
    return () => animation.stop()
  }, [isCollapsed, progress, fade, reduceMotion])
  // Switching tab: no full↔mini switch from scrolling until the bar has settled on that tab's state.
  useEffect(() => {
    lockedUntil = Date.now() + SWITCH_LOCK_MS
  }, [state.index])
  const fullWidth = Math.max(MINI_WIDTH, screenWidth - BAR_MARGIN * 2)
  // "index" only redirects to Home; it has no tab.
  const routes = state.routes.filter((route) => route.name !== "index")
  const focusedOptions = focusedKey ? descriptors[focusedKey]?.options : undefined
  if (StyleSheet.flatten(focusedOptions?.tabBarStyle)?.display === "none") return null

  const tabCount = Math.max(routes.length, 1)
  const fullSlot = (fullWidth - BAR_PADDING * 2) / tabCount
  const miniSlot = (MINI_WIDTH - MINI_PADDING * 2) / tabCount
  const fullPill = { width: Math.min(PILL_WIDTH, fullSlot), height: PILL_HEIGHT }
  const miniPill = { width: miniSlot, height: MINI_PILL_HEIGHT }

  // Geometry of the morph. The mini bar is centred and shares the full bar's bottom edge.
  const R = BAR_RADIUS
  const insetX = (fullWidth - MINI_WIDTH) / 2
  const dropY = BAR_HEIGHT - MINI_HEIGHT
  // Pieces overlap their neighbours by 0.5pt so no seam can open between them.
  const edgeWidth = fullWidth - R * 2 + 1
  const edgeScale = (MINI_WIDTH - R * 2 + 1) / edgeWidth
  const midHeight = BAR_HEIGHT - R * 2 + 1
  const midScale = (MINI_HEIGHT - R * 2 + 1) / midHeight
  const lerp = (to: number, from = 0) => progress.interpolate({ inputRange: [0, 1], outputRange: [from, to] })
  const slideIn = lerp(insetX)
  const slideInRight = lerp(-insetX)
  const drop = lerp(dropY)
  const halfDrop = lerp(dropY / 2)
  const stretchX = lerp(edgeScale, 1)
  const stretchY = lerp(midScale, 1)

  const tabs = routes.map((route) => {
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
    return {
      key: route.key,
      label,
      accessibilityLabel: options.tabBarAccessibilityLabel ?? label,
      focused,
      badge,
      icon: options.tabBarIcon?.({ focused, color: focused ? ACTIVE_ICON : INACTIVE, size: ICON_SIZE }),
      onPress: () => {
        const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true })
        if (!focused && !event.defaultPrevented) navigateToTab(route.key)
      },
      onLongPress: () => emitter.emit({ type: "tabLongPress", target: route.key }),
    }
  })

  const renderTapTargets = () =>
    tabs.map((tab) => (
      <Pressable
        key={tab.key}
        accessibilityRole="tab"
        accessibilityLabel={tab.accessibilityLabel}
        accessibilityHint={tab.badge > 0 ? `${tab.badge} upcoming` : undefined}
        accessibilityState={{ selected: tab.focused }}
        onPress={tab.onPress}
        onLongPress={tab.onLongPress}
        style={styles.tapTarget}
      />
    ))

  // Only the tap layer in use takes touches and is read by screen readers.
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: barBottomGap(insets.bottom) }]}>
      <Animated.View pointerEvents="box-none" style={{ width: fullWidth, height: BAR_HEIGHT, opacity: fade }}>
        {Platform.OS === "android" ? (
          // Android elevation needs a real background, so two plain rounded backdrops cast the
          // shadow at rest (full or mini) and hand over at the very start/end of the morph.
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.View
              style={[
                styles.backdrop,
                {
                  left: 0,
                  top: 0,
                  width: fullWidth,
                  height: BAR_HEIGHT,
                  opacity: progress.interpolate({ inputRange: [0, 0.12], outputRange: [1, 0], extrapolate: "clamp" }),
                  transform: [
                    { translateY: halfDrop },
                    { scaleX: lerp(MINI_WIDTH / fullWidth, 1) },
                    { scaleY: lerp(MINI_HEIGHT / BAR_HEIGHT, 1) },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.backdrop,
                {
                  left: insetX,
                  top: dropY,
                  width: MINI_WIDTH,
                  height: MINI_HEIGHT,
                  opacity: progress.interpolate({ inputRange: [0.88, 1], outputRange: [0, 1], extrapolate: "clamp" }),
                  transform: [
                    { translateY: lerp(0, -dropY / 2) },
                    { scaleX: lerp(1, fullWidth / MINI_WIDTH) },
                    { scaleY: lerp(1, BAR_HEIGHT / MINI_HEIGHT) },
                  ],
                },
              ]}
            />
          </View>
        ) : null}

        {/* The bar's shape. On iOS this container (no background of its own) casts one shadow from it. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, Platform.OS === "ios" ? styles.shapeShadow : null]}>
          <Animated.View
            style={[
              styles.fill,
              {
                left: R - 0.5,
                top: R - 0.5,
                width: edgeWidth,
                height: midHeight,
                transform: [{ translateY: halfDrop }, { scaleX: stretchX }, { scaleY: stretchY }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.fill,
              styles.edgeLeft,
              {
                left: 0,
                top: R - 0.5,
                width: R,
                height: midHeight,
                transform: [{ translateX: slideIn }, { translateY: halfDrop }, { scaleY: stretchY }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.fill,
              styles.edgeRight,
              {
                left: fullWidth - R,
                top: R - 0.5,
                width: R,
                height: midHeight,
                transform: [{ translateX: slideInRight }, { translateY: halfDrop }, { scaleY: stretchY }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.fill,
              styles.edgeTop,
              {
                left: R - 0.5,
                top: 0,
                width: edgeWidth,
                height: R + 0.5,
                transform: [{ translateY: drop }, { scaleX: stretchX }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.fill,
              styles.edgeBottom,
              {
                left: R - 0.5,
                top: BAR_HEIGHT - R - 0.5,
                width: edgeWidth,
                height: R + 0.5,
                transform: [{ scaleX: stretchX }],
              },
            ]}
          />
          <Corner left={0} top={0} circleLeft={0} circleTop={0} translateX={slideIn} translateY={drop} />
          <Corner left={fullWidth - R} top={0} circleLeft={-R} circleTop={0} translateX={slideInRight} translateY={drop} />
          <Corner left={0} top={BAR_HEIGHT - R} circleLeft={0} circleTop={-R} translateX={slideIn} />
          <Corner left={fullWidth - R} top={BAR_HEIGHT - R} circleLeft={-R} circleTop={-R} translateX={slideInRight} />
        </View>

        {/* What the tabs look like: icons slide between their full and mini spots. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill} {...hidden}>
          {tabs.map((tab, i) => {
            const fullX = BAR_PADDING + (i + 0.5) * fullSlot
            const miniX = insetX + MINI_PADDING + (i + 0.5) * miniSlot
            return (
              <TabVisual
                key={tab.key}
                left={BAR_PADDING + i * fullSlot}
                width={fullSlot}
                label={tab.label}
                focused={tab.focused}
                badge={tab.badge}
                icon={tab.icon}
                fullPill={fullPill}
                miniPill={miniPill}
                progress={progress}
                translateX={lerp(miniX - fullX)}
                translateY={lerp(MINI_ICON_Y - FULL_ICON_Y)}
              />
            )
          })}
        </View>

        {/* Tap layers: untransformed, one per mode. */}
        <View
          collapsable={false}
          pointerEvents={touchCollapsed ? "none" : "auto"}
          {...(touchCollapsed ? hidden : null)}
          style={styles.fullTaps}
          accessibilityRole="tablist"
        >
          {renderTapTargets()}
        </View>
        <View
          collapsable={false}
          pointerEvents={touchCollapsed ? "auto" : "none"}
          {...(touchCollapsed ? null : hidden)}
          style={[styles.miniTaps, { left: insetX }]}
          accessibilityRole="tablist"
        >
          {/* While mini, a tap on the bar outside the icons brings back the full bar. */}
          <Pressable
            accessibilityLabel="Show full menu"
            onPress={() => {
              if (focusedKey) setTabBarCollapsed(focusedKey, false)
            }}
            style={StyleSheet.absoluteFill}
          />
          {renderTapTargets()}
        </View>
      </Animated.View>
    </View>
  )
}

/** One rounded corner of the bar: a quarter of a bordered circle, which only ever moves. */
function Corner({
  left,
  top,
  circleLeft,
  circleTop,
  translateX,
  translateY,
}: {
  left: number
  top: number
  circleLeft: number
  circleTop: number
  translateX: Animated.AnimatedInterpolation<number>
  translateY?: Animated.AnimatedInterpolation<number>
}) {
  const transform = translateY ? [{ translateX }, { translateY }] : [{ translateX }]
  return (
    <Animated.View style={[styles.corner, { left, top, transform }]}>
      <View style={[styles.cornerCircle, { left: circleLeft, top: circleTop }]} />
    </Animated.View>
  )
}

function TabVisual({
  left,
  width,
  label,
  focused,
  badge,
  icon,
  fullPill,
  miniPill,
  progress,
  translateX,
  translateY,
}: {
  left: number
  width: number
  label: string
  focused: boolean
  badge: number
  icon: React.ReactNode
  fullPill: { width: number; height: number }
  miniPill: { width: number; height: number }
  progress: Animated.Value
  translateX: Animated.AnimatedInterpolation<number>
  translateY: Animated.AnimatedInterpolation<number>
}) {
  // The selected pill fades and scales in on the tab that becomes active.
  const grow = useRef(new Animated.Value(focused ? 1 : 0)).current
  useEffect(() => {
    Animated.spring(grow, { toValue: focused ? 1 : 0, damping: 18, stiffness: 220, useNativeDriver: true }).start()
  }, [focused, grow])

  // The full 52x30 pill stretches toward the taller mini pill and hands over to it midway.
  const toMiniX = miniPill.width / fullPill.width
  const toMiniY = miniPill.height / fullPill.height
  const fullPillStyle = {
    left: (width - fullPill.width) / 2,
    top: (PILL_HEIGHT - fullPill.height) / 2,
    opacity: progress.interpolate({ inputRange: [0.2, 0.7], outputRange: [1, 0], extrapolate: "clamp" }),
    transform: [
      { scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [1, toMiniX] }) },
      { scaleY: progress.interpolate({ inputRange: [0, 1], outputRange: [1, toMiniY] }) },
    ],
  }
  const miniPillStyle = {
    left: (width - miniPill.width) / 2,
    top: (PILL_HEIGHT - miniPill.height) / 2,
    opacity: progress.interpolate({ inputRange: [0.3, 0.8], outputRange: [0, 1], extrapolate: "clamp" }),
    transform: [
      { scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [1 / toMiniX, 1] }) },
      { scaleY: progress.interpolate({ inputRange: [0, 1], outputRange: [1 / toMiniY, 1] }) },
    ],
  }

  return (
    <Animated.View style={[styles.tabVisual, { left, width, transform: [{ translateX }, { translateY }] }]}>
      <View style={styles.iconArea}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: grow, transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] },
          ]}
        >
          <Animated.View style={[styles.pill, fullPill, fullPillStyle]} />
          <Animated.View style={[styles.pill, miniPill, miniPillStyle]} />
        </Animated.View>
        <Animated.View
          style={[
            styles.iconBox,
            { transform: [{ scale: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.92, 1] }) }] },
          ]}
        >
          {icon}
          {badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} allowFontScaling={false}>
                {badge > 9 ? "9+" : badge}
              </Text>
            </View>
          ) : null}
        </Animated.View>
      </View>
      <Animated.View
        style={[
          styles.labelWrap,
          {
            opacity: progress.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: "clamp" }),
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 0.5], outputRange: [0, 4], extrapolate: "clamp" }) },
            ],
          },
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
    </Animated.View>
  )
}

const BAR_SHADOW = {
  shadowColor: "#784632",
  shadowOpacity: 0.1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 8 },
} as const

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
  // Warm, soft lift (iOS: from the shape's pieces).
  shapeShadow: BAR_SHADOW,
  backdrop: {
    position: "absolute",
    borderRadius: BAR_RADIUS,
    backgroundColor: BAR_BG,
    elevation: 6,
  },
  // Pieces of the bar's shape. Opaque, so the 0.5pt overlaps between them never show.
  fill: {
    position: "absolute",
    backgroundColor: BAR_BG,
  },
  edgeLeft: { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: BAR_BORDER },
  edgeRight: { borderRightWidth: StyleSheet.hairlineWidth, borderColor: BAR_BORDER },
  edgeTop: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: BAR_BORDER },
  edgeBottom: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: BAR_BORDER },
  corner: {
    position: "absolute",
    width: BAR_RADIUS,
    height: BAR_RADIUS,
    overflow: "hidden",
  },
  cornerCircle: {
    position: "absolute",
    width: BAR_RADIUS * 2,
    height: BAR_RADIUS * 2,
    borderRadius: BAR_RADIUS,
    backgroundColor: BAR_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BAR_BORDER,
  },
  fullTaps: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_HEIGHT,
    padding: BAR_PADDING,
    flexDirection: "row",
  },
  miniTaps: {
    position: "absolute",
    bottom: 0,
    width: MINI_WIDTH,
    height: MINI_HEIGHT,
    padding: MINI_PADDING,
    flexDirection: "row",
  },
  tapTarget: {
    flex: 1,
  },
  // One tab's look, laid out in its full-bar slot; the morph only moves it.
  tabVisual: {
    position: "absolute",
    top: BAR_PADDING,
    height: BAR_HEIGHT - BAR_PADDING * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconArea: {
    alignSelf: "stretch",
    height: PILL_HEIGHT,
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
