import { Platform, StyleSheet } from "react-native"

import type { Salon } from "@/data/types"
import { getServiceTile, type ServiceTileKey } from "@/lib/service-tiles"
import { fontFamily } from "@/theme/tokens"

/** Salon page tokens (same as the new Home). */
export const sp = {
  text: "#111111",
  secondary: "#595959",
  label: "#4b5563",
  body: "#333333",
  border: "#e3e3e3",
  hairline: "#f0f0f0",
  tabBorder: "#ececec",
  grey: "#f3f3f3",
  ratingBg: "#e6f5ec",
  ratingInk: "#17633e",
  peachBg: "#fff1ec",
  peachInk: "#8a3524",
  star: "#b7791f",
  open: "#1f9d55",
  closed: "#d92d20",
  gutter: 20,
} as const

/** Pastel gradient pairs, taken from the Home service tiles. */
function tilePastel(key: ServiceTileKey) {
  const tile = getServiceTile(key)!
  return { gradient: tile.gradient, ink: tile.ink, fill: tile.fill }
}

export const pastels = {
  peach: tilePastel("haircut"),
  mint: tilePastel("facial"),
  sky: tilePastel("spa"),
  lavender: tilePastel("hair-colour"),
  gold: tilePastel("bridal"),
  pink: tilePastel("makeup"),
  teal: tilePastel("waxing"),
}

/** Package cards: gold first, then rotate. */
export const PACKAGE_PASTELS = [pastels.gold, pastels.pink, pastels.sky, pastels.mint, pastels.lavender, pastels.peach]

export const softShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  default: { elevation: 3 },
})!

export const ui = StyleSheet.create({
  sectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    color: sp.label,
    textTransform: "uppercase",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sp.gutter,
    marginTop: 28,
    marginBottom: 12,
  },
  seeAll: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: sp.text,
  },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  chipActive: {
    backgroundColor: sp.text,
    borderColor: sp.text,
  },
  chipText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: sp.text,
  },
  chipTextActive: {
    color: "#ffffff",
  },
  addPill: {
    height: 34,
    minWidth: 72,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: sp.text,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  addPillText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: sp.text,
  },
  addedPill: {
    height: 34,
    minWidth: 72,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: sp.peachBg,
    backgroundColor: sp.peachBg,
    alignItems: "center",
    justifyContent: "center",
  },
  addedPillText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: sp.peachInk,
  },
  blackPill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: sp.text,
    alignItems: "center",
    justifyContent: "center",
  },
  blackPillText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: "#ffffff",
  },
  offerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: sp.peachBg,
    flexShrink: 0,
  },
  offerBadgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 15,
    color: sp.peachInk,
  },
  strike: {
    textDecorationLine: "line-through",
  },
  pressed: {
    opacity: 0.85,
  },
})

/** Real dialable number, or null ("Contact salon for details" and digit-less values don't count). */
export function dialablePhone(phone: string | null | undefined): string | null {
  const value = (phone ?? "").trim()
  if (!value) return null
  if (value.toLowerCase() === "contact salon for details") return null
  if (!/\d/.test(value)) return null
  return value.replace(/[^\d+]/g, "")
}

/** Listing photo, cover and gallery, trimmed and deduped. */
export function salonFullGallery(salon: Pick<Salon, "imageUrl" | "coverImageUrl" | "gallery">): string[] {
  const urls: string[] = []
  for (const raw of [salon.imageUrl, salon.coverImageUrl, ...(salon.gallery ?? [])]) {
    const url = raw?.trim()
    if (url && !urls.includes(url)) urls.push(url)
  }
  return urls
}

function shortTime(value: string): string {
  // "10:00 AM" → "10 am", "8:30 PM" → "8:30 pm"
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])$/)
  if (!match) return value.trim()
  const [, h, m, ap] = match
  return `${Number(h)}${m && m !== "00" ? `:${m}` : ""} ${ap!.toLowerCase()}`
}

/**
 * Splits the salon hours string ("Mon–Sat · 10:00 AM – 9:00 PM") into days and a short range.
 * Returns null pieces when the string doesn't have that shape.
 */
export function parseSalonHours(hours: string | null | undefined): {
  days: string | null
  range: string | null
  closes: string | null
} {
  const value = (hours ?? "").trim()
  const times = value.match(/\d{1,2}(?::\d{2})?\s*[AaPp][Mm]/g) ?? []
  if (times.length < 2) return { days: null, range: null, closes: null }
  const open = shortTime(times[0]!)
  const close = shortTime(times[times.length - 1]!)
  const firstTimeAt = value.search(/\d{1,2}(?::\d{2})?\s*[AaPp][Mm]/)
  const days = value
    .slice(0, firstTimeAt)
    .replace(/[·|,\s-]+$/, "")
    .trim()
  return { days: days || null, range: `${open} – ${close}`, closes: close }
}

export function initialsOf(name: string, max = 2): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, max)
      .toUpperCase() || "G"
  )
}
