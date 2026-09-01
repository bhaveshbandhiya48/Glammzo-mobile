import { normalizeMobileDigits } from "@/lib/user"

/** Build a wa.me link for salon guest chat. Returns null when the number is invalid. */
export function salonWhatsAppUrl(
  phone: string | null | undefined,
  message?: string,
): string | null {
  const trimmed = phone?.trim()
  if (!trimmed) return null

  const digits = normalizeMobileDigits(trimmed)
  if (digits.length < 10) return null

  const intl = digits.length === 10 ? `91${digits}` : digits
  const base = `https://wa.me/${intl}`
  if (!message?.trim()) return base
  return `${base}?text=${encodeURIComponent(message.trim())}`
}
