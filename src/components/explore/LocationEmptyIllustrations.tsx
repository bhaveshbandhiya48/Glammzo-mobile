import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg"

import { colors } from "@/theme/tokens"

type Props = {
  width?: number
  height?: number
}

/** Soft map pin + empty nearby radius — for “nothing around you”. */
export function NearbyEmptyIllustration({ width = 240, height = 180 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 240 180" fill="none">
      <Ellipse cx="120" cy="156" rx="70" ry="9" fill={colors.sand} opacity={0.55} />

      {/* Soft ground wash */}
      <Ellipse cx="120" cy="132" rx="78" ry="24" fill="#11111110" />

      {/* Search radius rings — inset so full circle stays inside the viewBox */}
      <Circle
        cx="120"
        cy="100"
        r="48"
        stroke="#D4D4D4"
        strokeWidth="1.5"
        strokeDasharray="5 6"
        fill="#F1F1F1"
      />
      <Circle
        cx="120"
        cy="100"
        r="30"
        stroke={colors.primary}
        strokeWidth="1.5"
        strokeOpacity={0.35}
        fill="none"
      />

      {/* Distant city blocks */}
      <G opacity={0.55}>
        <Rect x="42" y="86" width="16" height="30" rx="4" fill={colors.sand} />
        <Rect x="62" y="76" width="14" height="40" rx="4" fill="#D4D4D4" />
        <Rect x="164" y="80" width="14" height="36" rx="4" fill={colors.sand} />
        <Rect x="182" y="90" width="18" height="26" rx="4" fill="#D4D4D4" />
      </G>

      {/* Map pin */}
      <Path
        d="M120 56c-12.7 0-23 10.1-23 22.6 0 16.6 23 40.4 23 40.4s23-23.8 23-40.4C143 66.1 132.7 56 120 56z"
        fill={colors.primary}
      />
      <Circle cx="120" cy="79" r="8" fill="#F1F1F1" />

      {/* Empty spark dots */}
      <Circle cx="68" cy="62" r="3" fill={colors.primary} opacity={0.35} />
      <Circle cx="178" cy="68" r="2.5" fill={colors.primary} opacity={0.28} />
      <Circle cx="84" cy="120" r="2" fill={colors.primary} opacity={0.22} />
    </Svg>
  )
}

/** Soft expanding map — for “not covering this area yet”. */
export function OutOfServiceIllustration({ width = 240, height = 180 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 240 180" fill="none">
      <Ellipse cx="120" cy="158" rx="74" ry="9" fill={colors.sand} opacity={0.55} />

      {/* Map card */}
      <Rect
        x="46"
        y="32"
        width="148"
        height="100"
        rx="18"
        fill="#F1F1F1"
        stroke="#D4D4D4"
        strokeWidth="1.5"
      />

      {/* Folded map folds */}
      <Path d="M95 32v100" stroke="#D4D4D4" strokeWidth="1" strokeDasharray="4 5" />
      <Path d="M145 32v100" stroke="#D4D4D4" strokeWidth="1" strokeDasharray="4 5" />

      {/* Roads */}
      <Path
        d="M62 82h116"
        stroke={colors.sand}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Path
        d="M120 48v72"
        stroke={colors.sand}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Path
        d="M62 82h116"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        strokeLinecap="round"
      />

      {/* Live coverage blob (served area) */}
      <Ellipse cx="82" cy="66" rx="18" ry="14" fill="#11111130" />
      <Circle cx="82" cy="66" r="5" fill={colors.primary} />

      {/* Current pin outside coverage */}
      <Path
        d="M158 62c-8.28 0-15 6.6-15 14.75 0 10.85 15 26.25 15 26.25s15-15.4 15-26.25C173 68.6 166.28 62 158 62z"
        fill={colors.primary}
      />
      <Circle cx="158" cy="77" r="5.5" fill="#F1F1F1" />

      {/* Growing arcs toward the pin */}
      <Path
        d="M102 74c10 2 22 8 34 18"
        stroke={colors.primary}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeDasharray="3 5"
        opacity={0.7}
      />
      <Circle cx="138" cy="90" r="2.5" fill={colors.primary} opacity={0.45} />

      {/* Small salon markers in live zone */}
      <Rect x="68" y="94" width="10" height="10" rx="2.5" fill={colors.sand} />
      <Rect x="84" y="100" width="8" height="8" rx="2" fill="#D4D4D4" />
    </Svg>
  )
}
