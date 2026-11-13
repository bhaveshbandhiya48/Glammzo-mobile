import { useId } from "react"
import { StyleSheet } from "react-native"
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg"

type Props = {
  colors: string[]
  /** CSS-style angle: 180 = top to bottom, 150 = top-left-ish to bottom-right. */
  angle?: number
  radius?: number
}

/**
 * Absolute-fill linear gradient drawn with react-native-svg (already a dependency),
 * so we don't need expo-linear-gradient. Place it first inside a positioned View.
 */
export function GradientFill({ colors, angle = 180, radius = 0 }: Props) {
  const rawId = useId()
  const id = `g${rawId.replace(/[^a-zA-Z0-9]/g, "")}`
  // CSS angle → unit vector (0deg points up, 90deg right) in a 0..1 box.
  const rad = (angle * Math.PI) / 180
  const dx = Math.sin(rad) / 2
  const dy = -Math.cos(rad) / 2
  const last = Math.max(colors.length - 1, 1)
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}>
          {colors.map((color, index) => (
            <Stop key={`${color}-${index}`} offset={index / last} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${id})`} />
    </Svg>
  )
}
