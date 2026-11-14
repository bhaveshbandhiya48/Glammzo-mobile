import Svg, { Circle, Path } from "react-native-svg"

export type QuickActionKind = "call" | "whatsapp" | "directions" | "share"

/** 24px duotone line icon: stroke 1.6 #2b2b2b plus one soft fill shape. */
export function QuickActionIcon({ kind, fill, size = 24 }: { kind: QuickActionKind; fill: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2b2b2b"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyph(kind, fill)}
    </Svg>
  )
}

function glyph(kind: QuickActionKind, fill: string) {
  switch (kind) {
    case "call":
      return (
        <Path
          d="M5 3.5h3.2l1.6 4-2.1 1.3a11 11 0 0 0 5.5 5.5l1.3-2.1 4 1.6V17a2 2 0 0 1-2 2A15.5 15.5 0 0 1 3 5.5a2 2 0 0 1 2-2z"
          fill={fill}
        />
      )
    case "whatsapp":
      return (
        <>
          <Path d="M12 3.5a8.5 8.5 0 0 0-7.4 12.7L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5z" fill={fill} />
          <Path d="M9 9.2c.2 2.6 3 5.4 5.8 5.8l1-1.3-1.6-1-.9.7a4.6 4.6 0 0 1-2.7-2.7l.7-.9-1-1.6z" />
        </>
      )
    case "directions":
      return (
        <>
          <Path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" fill={fill} />
          <Circle cx={12} cy={10} r={2.3} />
        </>
      )
    case "share":
      return (
        <>
          <Path d="M5 11v7.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V11" fill={fill} />
          <Path d="M12 14V3.5M8 7.5l4-4 4 4" />
        </>
      )
  }
}
