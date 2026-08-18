import { Ionicons } from "@expo/vector-icons"

import { resolveAmenityIcon } from "@/lib/amenity-icons"
import { colors } from "@/theme/tokens"

export type IconName = keyof typeof Ionicons.glyphMap

type Props = {
  /** Ionicons name, or CRM Lucide amenity id (resolved safely). */
  name: IconName | string
  size?: number
  color?: string
}

export function Icon({ name, size = 22, color = colors.text }: Props) {
  const resolved = resolveAmenityIcon(name)
  return <Ionicons name={resolved} size={size} color={color} />
}
