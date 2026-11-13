import Svg, { Circle, Path, Rect } from "react-native-svg"

import type { ServiceTile, ServiceTileKey } from "@/lib/service-tiles"

type Props = {
  tile: ServiceTile
  size?: number
}

/** Duotone line icon on a 24 viewBox: stroke 1.4, round caps, one soft fill shape. */
export function ServiceTileIcon({ tile, size = 32 }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tile.ink}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {renderGlyph(tile.key, tile.fill)}
    </Svg>
  )
}

function renderGlyph(key: ServiceTileKey, fill: string) {
  switch (key) {
    case "haircut":
      return (
        <>
          <Circle cx={6} cy={6} r={3} fill={fill} />
          <Circle cx={6} cy={18} r={3} fill={fill} />
          <Path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
        </>
      )
    case "hair-colour":
      return (
        <>
          <Path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" fill={fill} />
          <Path d="M9 15a3 3 0 0 0 3 3" />
        </>
      )
    case "facial":
      return (
        <>
          <Rect x={5} y={11} width={14} height={9} rx={3} fill={fill} />
          <Rect x={4} y={7} width={16} height={4} rx={2} />
          <Path d="M17 2.5v3M15.5 4h3" />
        </>
      )
    case "makeup":
      return (
        <>
          <Path d="M9.5 10V5.5L14.5 3v7z" fill={fill} />
          <Rect x={8.5} y={10} width={7} height={3} />
          <Rect x={8} y={13} width={8} height={8} rx={1.5} />
        </>
      )
    case "bridal":
      return (
        <>
          <Path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5z" fill={fill} />
          <Path d="M5 21h14" />
        </>
      )
    case "nails":
      return (
        <>
          <Rect x={10} y={3} width={4} height={6} rx={1} />
          <Rect x={7} y={9} width={10} height={12} rx={3} fill={fill} />
          <Path d="M9.5 12v5" />
        </>
      )
    case "spa":
      return (
        <>
          <Path d="M12 19c-2.5-2.5-3-7 0-12 3 5 2.5 9.5 0 12z" fill={fill} />
          <Path d="M12 19c-4 0-7.5-2-8.5-6 3.5 0 6 2 8.5 6zM12 19c4 0 7.5-2 8.5-6-3.5 0-6 2-8.5 6z" />
          <Path d="M5 21.5h14" />
        </>
      )
    case "waxing":
      // Wax strip with a drip.
      return (
        <>
          <Rect x={3} y={5} width={18} height={6} rx={2} fill={fill} />
          <Path d="M9 11v3.5a1.5 1.5 0 0 0 3 0V11" />
          <Path d="M6 8h4" />
          <Path d="M5 19h14" />
        </>
      )
    case "threading":
      // Brow arch over an eye.
      return (
        <>
          <Path d="M3 15s3.5-4.5 9-4.5 9 4.5 9 4.5-3.5 4.5-9 4.5S3 15 3 15z" fill={fill} />
          <Circle cx={12} cy={15} r={2} />
          <Path d="M4 7.5c3-2.5 13-2.5 16 0" />
        </>
      )
    case "mehendi":
      // Four-petal motif.
      return (
        <>
          <Circle cx={12} cy={12} r={3} fill={fill} />
          <Path d="M12 9c-1.5-2-1.5-4.5 0-6 1.5 1.5 1.5 4 0 6zM12 15c-1.5 2-1.5 4.5 0 6 1.5-1.5 1.5-4 0-6zM9 12c-2-1.5-4.5-1.5-6 0 1.5 1.5 4 1.5 6 0zM15 12c2-1.5 4.5-1.5 6 0-1.5 1.5-4 1.5-6 0z" />
        </>
      )
    case "beard":
      return (
        <>
          <Path d="M6 11c0 5 3 9 6 9s6-4 6-9c-1.5 1.5-3.5 2-6 2s-4.5-.5-6-2z" fill={fill} />
          <Path d="M6 11V8a6 6 0 0 1 12 0v3" />
          <Path d="M9.5 15.5c1-.8 2-.8 2.5 0 .5-.8 1.5-.8 2.5 0" />
        </>
      )
    case "lashes":
      // Closed eye with lashes.
      return (
        <>
          <Path d="M3 9c2.5 4 6 6 9 6s6.5-2 9-6c-2.5 1.5-5.5 2.5-9 2.5S5.5 10.5 3 9z" fill={fill} />
          <Path d="M6 12.5 4.5 15M9.5 14.5 9 17.5M14.5 14.5l.5 3M18 12.5l1.5 2.5" />
        </>
      )
  }
}

/** "All services": four rounded squares, two filled. */
export function AllServicesIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1f2937"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x={4} y={4} width={6.5} height={6.5} rx={2} />
      <Rect x={13.5} y={4} width={6.5} height={6.5} rx={2} fill="#e5e7eb" />
      <Rect x={4} y={13.5} width={6.5} height={6.5} rx={2} fill="#e5e7eb" />
      <Rect x={13.5} y={13.5} width={6.5} height={6.5} rx={2} />
    </Svg>
  )
}
