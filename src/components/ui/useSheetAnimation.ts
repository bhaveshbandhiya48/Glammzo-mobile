import { useCallback, useEffect, useRef, useState } from "react"
import { Animated, Dimensions, Easing } from "react-native"

const OFFSCREEN = Dimensions.get("window").height

/**
 * Backdrop fades while the sheet slides up from below, instead of the Modal sliding the
 * dark backdrop in as one block. Keeps the Modal mounted until the close animation ends.
 */
export function useSheetAnimation(visible: boolean) {
  const [mounted, setMounted] = useState(visible)
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const sheetY = useRef(new Animated.Value(OFFSCREEN)).current
  /** Set when swipe already took the sheet off-screen — skip the exit slide. */
  const skipExitAnimRef = useRef(false)

  const markDragDismissed = useCallback(() => {
    skipExitAnimRef.current = true
  }, [])

  useEffect(() => {
    if (visible) {
      skipExitAnimRef.current = false
      setMounted(true)
      backdropOpacity.setValue(0)
      sheetY.setValue(OFFSCREEN)
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(sheetY, {
          toValue: 0,
          damping: 26,
          stiffness: 260,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start()
      return
    }
    if (!mounted) return

    if (skipExitAnimRef.current) {
      skipExitAnimRef.current = false
      backdropOpacity.setValue(0)
      sheetY.setValue(OFFSCREEN)
      setMounted(false)
      return
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetY, {
        toValue: OFFSCREEN,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on visibility changes only
  }, [visible])

  return { mounted, backdropOpacity, sheetY, markDragDismissed }
}
