import { useEventListener } from "expo"
import { useVideoPlayer, VideoView } from "expo-video"
import { useCallback, useEffect, useRef } from "react"
import { Animated, Easing, StyleSheet, View } from "react-native"

import { colors } from "@/theme/tokens"

type Props = {
  onFinish: () => void
}

const SPLASH_VIDEO = require("../../../assets/brand/splash.mp4")
/** Show the splash clip briefly, then fade into the app. */
const SPLASH_VISIBLE_MS = 3_500

/**
 * Full-screen brand splash video (~3.5s), then a short fade into the app.
 */
export function AnimatedSplash({ onFinish }: Props) {
  const finishedRef = useRef(false)
  const overlayOpacity = useRef(new Animated.Value(1)).current

  const player = useVideoPlayer(SPLASH_VIDEO, (instance) => {
    instance.loop = false
    instance.muted = true
    instance.audioMixingMode = "mixWithOthers"
    instance.play()
  })

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    try {
      player.pause()
    } catch {
      // Player may already be released.
    }
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 380,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onFinish())
  }, [onFinish, overlayOpacity, player])

  useEventListener(player, "statusChange", ({ status, error }) => {
    if (status === "error") {
      console.warn("[splash] video failed:", error?.message ?? error)
      finish()
    }
  })

  useEffect(() => {
    const timeout = setTimeout(finish, SPLASH_VISIBLE_MS)
    return () => clearTimeout(timeout)
  }, [finish])

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { opacity: overlayOpacity }]}
    >
      <View style={styles.frame}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
          allowsPictureInPicture={false}
        />
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
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
})
