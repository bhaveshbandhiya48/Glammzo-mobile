import { Image } from "expo-image"
import { useEffect, useState } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import Svg, { Circle } from "react-native-svg"

import { GradientFill } from "@/components/home/GradientFill"
import { Text } from "@/components/ui/Text"
import { SERVICE_TILES, type ServiceTile } from "@/lib/service-tiles"
import { fontFamily } from "@/theme/tokens"

/** Same name → same pastel tile every time (simple string hash over the tile palette). */
export function pastelForName(name: string): Pick<ServiceTile, "gradient" | "ink"> {
  let hash = 0
  for (const char of name.trim().toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }
  const tile = SERVICE_TILES[Math.abs(hash) % SERVICE_TILES.length] ?? SERVICE_TILES[0]
  return { gradient: tile.gradient, ink: tile.ink }
}

function initialOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || "G"
}

/** Large designed placeholder: pastel gradient, faint ring, initial in a white rounded square. */
export function PhotoFallback({ name }: { name: string }) {
  const { gradient, ink } = pastelForName(name)
  return (
    <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <GradientFill colors={gradient} angle={150} />
      <Svg style={styles.ring} width={180} height={180} pointerEvents="none">
        <Circle cx={90} cy={90} r={68} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={22} fill="none" />
      </Svg>
      <View style={styles.center}>
        <View style={styles.square}>
          <Text style={[styles.initial, { color: ink }]}>{initialOf(name)}</Text>
        </View>
      </View>
    </View>
  )
}

/** Photo when the URL exists and loads; otherwise the designed fallback. Fills its parent. */
export function PhotoOrFallback({ uri, name }: { uri?: string | null; name: string }) {
  const clean = uri?.trim() || ""
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [clean])
  if (!clean || failed) return <PhotoFallback name={name} />
  return (
    <Image
      source={{ uri: clean }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      transition={150}
      onError={() => setFailed(true)}
    />
  )
}

/** Small square thumb (Book again chip): photo, or gradient + initial. */
export function ThumbOrFallback({
  uri,
  name,
  style,
}: {
  uri?: string | null
  name: string
  style?: StyleProp<ViewStyle>
}) {
  const clean = uri?.trim() || ""
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [clean])
  const { gradient, ink } = pastelForName(name)
  return (
    <View style={[styles.thumb, style]}>
      {clean && !failed ? (
        <Image
          source={{ uri: clean }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <GradientFill colors={gradient} angle={150} />
          <Text style={[styles.thumbInitial, { color: ink }]}>{initialOf(name)}</Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    right: -56,
    bottom: -64,
  },
  center: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  square: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontFamily: fontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbInitial: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 20,
  },
})
