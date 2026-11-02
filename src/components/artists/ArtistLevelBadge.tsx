import { useId } from "react"
import { StyleSheet, View } from "react-native"
import Svg, { Defs, LinearGradient, Path, Polygon, Stop } from "react-native-svg"

import { Text } from "@/components/ui/Text"
import { ARTIST_LEVEL_BADGE, type ArtistLevelId } from "@/lib/artist-level"

/** Pointy-top hexagon around (50, 50). */
function hexagon(r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`
  }).join(" ")
}

/** Five-point star centred at (cx, cy). */
function star(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / 5) * i - Math.PI / 2
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`
  }).join(" ")
}

/**
 * Level medal, the same design as the Partner app: a hexagon in the level's colour with an
 * embossed emblem. Getting started has a star; Rising adds one rank chevron, Established
 * two; Signature trades the star for a crown on gold.
 */
export function ArtistLevelBadge({
  level,
  size = 20,
  label,
}: {
  level: ArtistLevelId
  size?: number
  /** Optional text beside the medal (e.g. "Rising"). */
  label?: string | null
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "")
  const badge = ARTIST_LEVEL_BADGE[level]
  // With chevrons under it, the emblem sits a little higher.
  const emblemY = badge.chevrons > 0 ? 43 : 50

  return (
    <View style={styles.wrap} accessibilityLabel={label ? `${label} level` : undefined}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`o${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={badge.outerTop} />
            <Stop offset="1" stopColor={badge.outerBottom} />
          </LinearGradient>
          <LinearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={badge.faceTop} />
            <Stop offset="1" stopColor={badge.faceBottom} />
          </LinearGradient>
        </Defs>
        <Polygon points={hexagon(46)} fill={`url(#o${id})`} stroke={badge.stroke} strokeWidth={3} strokeLinejoin="round" />
        <Path d="M50 4 L89.84 27 L50 38 L10.16 27 Z" fill="#FFFFFF" opacity={0.35} />
        <Polygon
          points={hexagon(35)}
          fill={`url(#f${id})`}
          stroke={badge.stroke}
          strokeOpacity={0.45}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {badge.mark === "crown" ? (
          <Path
            d={`M29 ${emblemY + 13} L32 ${emblemY - 10} L42 ${emblemY + 1} L50 ${emblemY - 16} L58 ${emblemY + 1} L68 ${emblemY - 10} L71 ${emblemY + 13} Z`}
            fill={badge.emblem}
            stroke={badge.emblem}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ) : (
          <Polygon
            points={star(50, emblemY, 17, 7.2)}
            fill={badge.emblem}
            stroke={badge.emblem}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        )}
        {Array.from({ length: badge.chevrons }).map((_, i) => {
          const y = 61 + i * 9
          return (
            <Path
              key={i}
              d={`M39 ${y} L50 ${y + 6} L61 ${y}`}
              fill="none"
              stroke={badge.emblem}
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}
      </Svg>
      {label ? (
        <Text variant="caption" muted numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
})
