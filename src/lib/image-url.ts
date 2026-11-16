import { PixelRatio } from "react-native"

import { API_URL } from "@/lib/config"

/**
 * Widths Glammzo-web's image optimizer accepts (Next's default deviceSizes + imageSizes).
 * Any other `w` is rejected, so we round up to the next one.
 */
const OPTIMIZER_WIDTHS = [64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920]

/** Only hosts Glammzo-web's `images.remotePatterns` allows; others pass through untouched. */
function isOptimizableHost(hostname: string) {
  const host = hostname.toLowerCase()
  return (
    host.endsWith(".supabase.co") ||
    host === "images.unsplash.com" ||
    host === "images.pexels.com"
  )
}

function optimizerWidth(displayWidth: number) {
  const pixels = Math.ceil(displayWidth * PixelRatio.get())
  return OPTIMIZER_WIDTHS.find((w) => w >= pixels) ?? OPTIMIZER_WIDTHS[OPTIMIZER_WIDTHS.length - 1]
}

/**
 * A resized, compressed copy of a salon / artist photo, sized for where it is shown.
 * Uploaded originals are often several MB straight from a phone camera; the web's
 * image optimizer serves a WebP at screen size and caches it at the edge.
 * Returns the original URL when the host is not one the optimizer serves.
 */
export function optimizedImageUrl(uri: string | null | undefined, displayWidth: number): string | null {
  const raw = uri?.trim()
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== "https:" || !isOptimizableHost(parsed.hostname)) return raw
  } catch {
    return raw
  }
  // Next 16 only accepts the quality values in `images.qualities`, which defaults to [75].
  return `${API_URL}/_next/image?url=${encodeURIComponent(raw)}&w=${optimizerWidth(displayWidth)}&q=75`
}
