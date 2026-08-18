import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg"

import { colors } from "@/theme/tokens"

type Props = {
  width?: number
  height?: number
}

/** Soft calendar centered inside a circle — empty bookings. */
export function BookingsEmptyIllustration({ width = 240, height = 180 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 240 180" fill="none">
      <Ellipse cx="120" cy="158" rx="68" ry="8" fill={colors.sand} opacity={0.55} />

      {/* Outer circle frame — calendar sits inside this */}
      <Circle
        cx="120"
        cy="92"
        r="68"
        fill="#FFF7F5"
        stroke="#F8C9C1"
        strokeWidth="1.5"
      />
      <Circle
        cx="120"
        cy="92"
        r="58"
        stroke={colors.coral}
        strokeWidth="1.25"
        strokeOpacity={0.28}
        strokeDasharray="5 6"
        fill="none"
      />

      {/* Calendar body — centered in the circle */}
      <Rect
        x="74"
        y="52"
        width="92"
        height="78"
        rx="14"
        fill={colors.surface}
        stroke="#F8C9C1"
        strokeWidth="1.5"
      />

      {/* Binding bar */}
      <Path
        d="M74 66V60c0-7.7 6.3-14 14-14h64c7.7 0 14 6.3 14 14v6H74z"
        fill={colors.coral}
      />
      <Rect x="74" y="66" width="92" height="10" fill={colors.coral} />

      {/* Binder rings sitting through the top bar */}
      <Rect x="94" y="44" width="8" height="20" rx="4" fill="#FFF7F5" />
      <Rect x="138" y="44" width="8" height="20" rx="4" fill="#FFF7F5" />
      <Circle cx="98" cy="50" r="2.75" fill={colors.sand} />
      <Circle cx="142" cy="50" r="2.75" fill={colors.sand} />

      {/* Day grid centered on calendar */}
      <Rect x="86" y="88" width="14" height="12" rx="3" fill={colors.muted} />
      <Rect x="105" y="88" width="14" height="12" rx="3" fill={colors.muted} />
      <Rect x="124" y="88" width="14" height="12" rx="3" fill={colors.muted} />
      <Rect x="143" y="88" width="14" height="12" rx="3" fill={colors.muted} />

      <Rect x="86" y="106" width="14" height="12" rx="3" fill={colors.muted} />
      <Rect x="105" y="106" width="14" height="12" rx="3" fill="#F8C9C1" />
      <Rect x="124" y="106" width="14" height="12" rx="3" fill={colors.muted} />
      <Rect x="143" y="106" width="14" height="12" rx="3" fill={colors.muted} />

      {/* Accent dot centered in the highlighted day */}
      <Circle cx="112" cy="112" r="2.75" fill={colors.coral} />
    </Svg>
  )
}
