/** Known production / live hosts — never use these while developing mobile. */
const PRODUCTION_HOST_SNIPPETS = [
  "hcmoguosknynscbctloa.supabase.co",
  "glammzo.com",
  "www.glammzo.com",
  "app.glammzo.com",
]

/**
 * Warn (and in __DEV__ loudly) if API_URL points at a production host.
 * Staging/local Glammzo-web should use .env.development Supabase only.
 */
export function assertStagingApiUrl(url: string): void {
  const lower = url.toLowerCase()
  const hit = PRODUCTION_HOST_SNIPPETS.find((snippet) => lower.includes(snippet))
  if (!hit) return

  const message =
    `[Glammzo] EXPO_PUBLIC_API_URL looks like production (${hit}). ` +
    `Use staging/local Glammzo-web only (e.g. http://localhost:4008 or your LAN IP).`

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.error(message)
  } else {
    console.warn(message)
  }
}
