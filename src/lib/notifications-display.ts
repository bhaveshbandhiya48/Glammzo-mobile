import type { IconName } from "@/components/ui/Icon"
import type { AppNotificationType } from "@/lib/notifications-build"
import { colors, status } from "@/theme/tokens"

export function notificationIcon(type: AppNotificationType): IconName {
  switch (type) {
    case "booking_confirmed":
      return "checkmark-circle-outline"
    case "booking_pending":
      return "hourglass-outline"
    case "booking_reminder":
      return "alarm-outline"
    case "booking_completed":
      return "ribbon-outline"
    case "booking_cancelled":
    case "booking_declined":
      return "close-circle-outline"
    case "cashback":
      return "wallet-outline"
    case "loyalty":
      return "gift-outline"
    default:
      return "notifications-outline"
  }
}

/** Status tint for the icon tile: colour only says what kind of update it is. */
export function notificationTone(type: AppNotificationType): { fg: string; bg: string } {
  switch (type) {
    case "booking_confirmed":
    case "booking_completed":
    case "loyalty":
      return { fg: status.successFg, bg: status.successBg }
    case "booking_reminder":
    case "booking_pending":
      return { fg: status.warnFg, bg: status.warnBg }
    case "booking_cancelled":
    case "booking_declined":
      return { fg: status.dangerFg, bg: status.dangerBg }
    case "cashback":
      return { fg: status.infoFg, bg: status.infoBg }
    default:
      return { fg: colors.text, bg: colors.muted }
  }
}

/** "Today", "Yesterday", "This week" or "Earlier" for grouping the list. */
export function notificationGroup(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Earlier"
  const startOf = (v: Date) => new Date(v.getFullYear(), v.getMonth(), v.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return "This week"
  return "Earlier"
}

export function formatNotificationTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diffMs = Date.now() - then
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })
}
