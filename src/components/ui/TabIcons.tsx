import Svg, { Circle, Path, Rect } from "react-native-svg"
import type { ColorValue } from "react-native"

type Props = {
  color: ColorValue
  size?: number
  focused?: boolean
}

/** Modern stroke icons for the tab bar (not Ionicons/Material). */
export function HomeTabIcon({ color, size = 24, focused = false }: Props) {
  const stroke = focused ? 2.25 : 1.75
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 10.5 12 4l7.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.25v-5.25h-5.5V20.5H6A1.5 1.5 0 0 1 4.5 19V10.5Z"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? color : "none"}
        fillOpacity={focused ? 0.12 : 0}
      />
    </Svg>
  )
}

export function BookingsTabIcon({ color, size = 24, focused = false }: Props) {
  const stroke = focused ? 2.25 : 1.75
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3.75"
        y="5.25"
        width="16.5"
        height="15"
        rx="3"
        stroke={color}
        strokeWidth={stroke}
        fill={focused ? color : "none"}
        fillOpacity={focused ? 0.12 : 0}
      />
      <Path
        d="M8 3.75v3M16 3.75v3M3.75 10.5h16.5"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {focused ? (
        <Circle cx="12" cy="15.25" r="1.35" fill={color} />
      ) : (
        <Path
          d="M8.5 14.5h3M8.5 17h7"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      )}
    </Svg>
  )
}

export function ProfileTabIcon({ color, size = 24, focused = false }: Props) {
  const stroke = focused ? 2.25 : 1.75
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="8.25"
        r="3.25"
        stroke={color}
        strokeWidth={stroke}
        fill={focused ? color : "none"}
        fillOpacity={focused ? 0.12 : 0}
      />
      <Path
        d="M5.5 19.25c1.4-3.1 3.7-4.75 6.5-4.75s5.1 1.65 6.5 4.75"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </Svg>
  )
}
