import { useEffect, useMemo, useRef, type ReactNode } from "react"
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native"

/**
 * Swipe left/right on a tab root screen to reach the neighbouring tab, like a pager.
 * Finger moving left-to-right goes to the tab on the left; right-to-left goes right. No wrap-around.
 *
 * Built on the JS responder system (no extra native module, no gesture root needed):
 * - Inner horizontal ScrollViews (carousels, chip rows) start scrolling natively after ~8pt and
 *   take the touch away from JS, so they always win over this 24pt threshold.
 * - Vertical movement past 12pt before 24pt horizontal cancels the swipe for that touch,
 *   so vertical scrolling always wins.
 * - Sheets are RN `Modal`s (separate native window) and never reach this view.
 * - In-screen overlays that pan (the map) call `useBlockTabSwipe(true)` while open.
 */

/** Tab order, left to right. Must match app/(tabs)/_layout.tsx. */
export const SWIPE_TAB_ORDER = ["explore", "bookings", "profile"] as const

const ACTIVATE_X = 24
const FAIL_Y = 12
const COMMIT_FRACTION = 0.25
/** PanResponder velocity is px/ms: 0.6 = 600 px/s. */
const COMMIT_VELOCITY = 0.6
/** The screen follows the finger at this fraction, capped, as feedback. */
const FOLLOW = 0.35
const FOLLOW_MAX = 70
const EDGE_FOLLOW = 0.1
const EDGE_MAX = 18
const EXIT_MS = 110
const ENTER_MS = 200
const ENTER_OFFSET = 36

// Blockers (e.g. the map overlay) — read when a swipe tries to start, no re-render needed.
let blockCount = 0

/** While `active`, tab swiping is off (for in-screen overlays with their own horizontal panning). */
export function useBlockTabSwipe(active: boolean) {
  useEffect(() => {
    if (!active) return
    blockCount += 1
    return () => {
      blockCount -= 1
    }
  }, [active])
}

type Anim = { x: Animated.Value; opacity: Animated.Value }
const anims = new Map<string, Anim>()
/** Set just before navigating, so a tab that mounts lazily still slides in. */
let pendingEnter: { name: string; from: number } | null = null

function playEnter(anim: Anim, from: number) {
  anim.x.setValue(from)
  anim.opacity.setValue(0.5)
  Animated.parallel([
    Animated.timing(anim.x, {
      toValue: 0,
      duration: ENTER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
    Animated.timing(anim.opacity, {
      toValue: 1,
      duration: ENTER_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
  ]).start()
}

type Props = {
  routeName: string
  navigate: (name: string) => void
  isFocused: () => boolean
  children: ReactNode
}

export function SwipeableTabScreen({ routeName, navigate, isFocused, children }: Props) {
  const { width } = useWindowDimensions()
  const index = SWIPE_TAB_ORDER.indexOf(routeName as (typeof SWIPE_TAB_ORDER)[number])

  const anim = useRef<Anim | null>(null)
  if (!anim.current) anim.current = { x: new Animated.Value(0), opacity: new Animated.Value(1) }

  useEffect(() => {
    const own = anim.current!
    anims.set(routeName, own)
    if (pendingEnter?.name === routeName) {
      playEnter(own, pendingEnter.from)
      pendingEnter = null
    }
    return () => {
      if (anims.get(routeName) === own) anims.delete(routeName)
    }
  }, [routeName])

  // Kept in refs so the responder (created once) always sees current values.
  const live = useRef({ width, index, navigate, isFocused })
  live.current = { width, index, navigate, isFocused }

  const responder = useMemo(() => {
    let failed = false

    const neighbour = (dx: number) => {
      const target = live.current.index + (dx > 0 ? -1 : 1)
      return SWIPE_TAB_ORDER[target]
    }

    const reset = () => {
      Animated.spring(anim.current!.x, {
        toValue: 0,
        useNativeDriver: true,
        speed: 24,
        bounciness: 0,
      }).start()
    }

    return PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        failed = false
        return false
      },
      onMoveShouldSetPanResponder: (e: GestureResponderEvent, g: PanResponderGestureState) => {
        if (failed || blockCount > 0 || live.current.index < 0) return false
        if (g.numberActiveTouches !== 1 || !live.current.isFocused()) return false
        if (Math.abs(g.dy) > FAIL_Y) {
          failed = true
          return false
        }
        return Math.abs(g.dx) > ACTIVATE_X && Math.abs(g.dx) > Math.abs(g.dy) * 2
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderMove: (_e, g) => {
        const hasTarget = neighbour(g.dx) !== undefined
        const sign = Math.sign(g.dx)
        const moved = hasTarget
          ? Math.min(Math.abs(g.dx) * FOLLOW, FOLLOW_MAX)
          : Math.min(Math.abs(g.dx) * EDGE_FOLLOW, EDGE_MAX)
        anim.current!.x.setValue(sign * moved)
      },
      onPanResponderRelease: (_e, g) => {
        const target = neighbour(g.dx)
        const far = Math.abs(g.dx) > live.current.width * COMMIT_FRACTION
        const fast = Math.abs(g.vx) > COMMIT_VELOCITY && Math.sign(g.vx) === Math.sign(g.dx)
        if (!target || !(far || fast)) {
          reset()
          return
        }
        const sign = Math.sign(g.dx)
        const own = anim.current!
        Animated.parallel([
          Animated.timing(own.x, {
            toValue: sign * (FOLLOW_MAX + 30),
            duration: EXIT_MS,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(own.opacity, {
            toValue: 0.4,
            duration: EXIT_MS,
            useNativeDriver: true,
          }),
        ]).start(() => {
          const from = -sign * ENTER_OFFSET
          const incoming = anims.get(target)
          if (incoming) {
            incoming.x.setValue(from)
            incoming.opacity.setValue(0.5)
          } else {
            pendingEnter = { name: target, from }
          }
          live.current.navigate(target)
          if (incoming) playEnter(incoming, from)
          // Outgoing screen is hidden by now; put it back for next time it is shown.
          setTimeout(() => {
            own.x.setValue(0)
            own.opacity.setValue(1)
          }, 120)
        })
      },
      onPanResponderTerminate: reset,
    })
  }, [])

  if (index < 0) return <>{children}</>

  return (
    <Animated.View
      style={[
        styles.fill,
        { opacity: anim.current.opacity, transform: [{ translateX: anim.current.x }] },
      ]}
      {...responder.panHandlers}
    >
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
