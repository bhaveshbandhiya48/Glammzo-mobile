import { Ionicons } from "@expo/vector-icons"

type IoniconName = keyof typeof Ionicons.glyphMap

/**
 * CRM / Glammzo-web amenity icons use Lucide ids.
 * Mobile renders Ionicons — map the catalog + common fallbacks.
 */
const LUCIDE_AMENITY_TO_IONICONS: Record<string, IoniconName> = {
  Wifi: "wifi-outline",
  ParkingCircle: "car-outline",
  CircleParking: "car-outline",
  Car: "car-outline",
  Coffee: "cafe-outline",
  CreditCard: "card-outline",
  Armchair: "bed-outline",
  Accessibility: "accessibility-outline",
  Baby: "happy-outline",
  Sparkles: "sparkles-outline",
  AirVent: "snow-outline",
  Zap: "flash-outline",
  Plug: "battery-charging-outline",
  Smartphone: "phone-portrait-outline",
  Nfc: "radio-outline",
  ArrowUpDown: "swap-vertical-outline",
  Bath: "water-outline",
  PawPrint: "paw-outline",
  Venus: "female-outline",
  DoorClosed: "lock-closed-outline",
  DoorOpen: "enter-outline",
  GlassWater: "water-outline",
  ShieldCheck: "shield-checkmark-outline",
  SprayCan: "color-fill-outline",
  Cctv: "videocam-outline",
}

const FALLBACK: IoniconName = "sparkles-outline"

function isIonicon(name: string): name is IoniconName {
  return name in Ionicons.glyphMap
}

/** Resolve CRM Lucide / legacy / Ionicon names to a safe Ionicons glyph. */
export function resolveAmenityIcon(name: string | null | undefined): IoniconName {
  const raw = name?.trim()
  if (!raw) return FALLBACK
  if (isIonicon(raw)) return raw
  const mapped = LUCIDE_AMENITY_TO_IONICONS[raw]
  if (mapped) return mapped
  const withOutline = raw.endsWith("-outline") ? raw : `${raw}-outline`
  if (isIonicon(withOutline)) return withOutline
  return FALLBACK
}
