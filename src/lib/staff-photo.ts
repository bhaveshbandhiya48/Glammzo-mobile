/**
 * glammzo.com fills a missing staff photo with its own placeholder drawing. The app shows a
 * line person icon instead, so only real photos count.
 */
export function staffPhotoUrl(raw: string | null | undefined): string | null {
  const url = raw?.trim()
  if (!url || url.includes("/images/staff/avatar-")) return null
  return url
}
