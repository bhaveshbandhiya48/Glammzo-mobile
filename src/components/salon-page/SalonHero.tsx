import { Image } from "expo-image"
import { useState } from "react"
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg"

import { GradientFill } from "@/components/home/GradientFill"
import { pastelForName } from "@/components/home/PhotoFallback"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

export const HERO_HEIGHT = 300

type Props = {
  slides: string[]
  name: string
  width: number
  onOpenPhoto: (index: number) => void
}

/** Soft top scrim so the white buttons and status bar read on light photos. */
function TopScrim() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="salonHeroScrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity="0.35" />
          <Stop offset="0.35" stopColor="#000000" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#salonHeroScrim)" />
    </Svg>
  )
}

/** Big hero fallback: pastel gradient with an 88px rounded initial square. */
function HeroFallback({ name }: { name: string }) {
  const { gradient, ink } = pastelForName(name)
  return (
    <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <GradientFill colors={gradient} angle={150} />
      <View style={styles.fallbackCenter}>
        <View style={styles.fallbackSquare}>
          <Text style={[styles.fallbackInitial, { color: ink }]}>
            {name.trim().charAt(0).toUpperCase() || "G"}
          </Text>
        </View>
      </View>
    </View>
  )
}

export function SalonHero({ slides, name, width, onOpenPhoto }: Props) {
  const [index, setIndex] = useState(0)

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1))
    if (next !== index) setIndex(next)
  }

  return (
    <View style={[styles.wrap, { width, height: HERO_HEIGHT }]}>
      {slides.length === 0 ? (
        <HeroFallback name={name} />
      ) : (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            directionalLockEnabled
            disableIntervalMomentum
            showsHorizontalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            onMomentumScrollEnd={onMomentumEnd}
            style={{ width, height: HERO_HEIGHT }}
          >
            {slides.map((uri, slideIndex) => (
              <Pressable
                key={`${uri}-${slideIndex}`}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Photo ${slideIndex + 1} of ${slides.length}. Open full screen`}
                onPress={() => onOpenPhoto(slideIndex)}
                style={{ width, height: HERO_HEIGHT }}
              >
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              </Pressable>
            ))}
          </ScrollView>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <TopScrim />
          </View>
          {slides.length > 1 ? (
            <View style={styles.counter} pointerEvents="none">
              <Text style={styles.counterText}>
                {index + 1} / {slides.length}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#f3f3f3",
  },
  counter: {
    position: "absolute",
    right: 16,
    bottom: 40,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(17,17,17,0.7)",
  },
  counterText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: "#ffffff",
  },
  fallbackCenter: {
    position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackSquare: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackInitial: {
    fontFamily: fontFamily.bold,
    fontSize: 36,
    lineHeight: 44,
  },
})
