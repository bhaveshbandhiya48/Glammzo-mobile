import { useCallback, useEffect, useRef, useState } from "react"
import { Animated, Easing, StyleSheet, View } from "react-native"

import { Logo } from "@/components/brand/Logo"
import { colors } from "@/theme/tokens"

type Props = {
  onFinish: () => void
}

/** Brief brand hold, then fade into the app (no native video — avoids Android release crashes). */
const SPLASH_VISIBLE_MS = 1_600

/**
 * Full-screen cream splash with logo. Avoids expo-video on the cold-start path:
 * video players have caused instant Android release crashes before the UI mounts.
 */
export function AnimatedSplash({ onFinish }: Props) {
  const finishedRef = useRef(false)
  const overlayOpacity = useRef(new Animated.Value(1)).current
  const logoOpacity = useRef(new Animated.Value(0)).current
  const [ready, setReady] = useState(false)

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinish()
      else onFinish()
    })
  }, [onFinish, overlayOpacity])

  useEffect(() => {
    setReady(true)
    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
    const timeout = setTimeout(finish, SPLASH_VISIBLE_MS)
    return () => clearTimeout(timeout)
  }, [finish, logoOpacity])

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { opacity: overlayOpacity }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.frame}>
        {ready ? (
          <Animated.View style={{ opacity: logoOpacity }}>
            <Logo size="lg" />
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: colors.bg,
  },
  frame: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
})
