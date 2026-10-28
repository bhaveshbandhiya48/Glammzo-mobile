import type { IconName } from "@/components/ui/Icon"
import type { AppNotificationType } from "@/lib/notifications-build"
import { colors } from "@/theme/tokens"

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

export function notificationAccent(type: AppNotificationType): string {
  switch (type) {
    case "booking_confirmed":
    case "booking_completed":
    case "loyalty":
      return colors.success
    case "booking_reminder":
    case "booking_pending":
      return "#B45309"
    case "booking_cancelled":
    case "booking_declined":
      return colors.destructive
    case "cashback":
      return colors.primary
    default:
      return colors.textMuted
  }
}

export function formatNotificationTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diffMs = Date.now() - then
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })
}
