/**
 * Public legal pages on Glammzo-web (same copy as the consumer site).
 * Override with EXPO_PUBLIC_SITE_URL only if you need a non-production host.
 */
const SITE_URL = (
  process.env.EXPO_PUBLIC_SITE_URL?.trim() || "https://glammzo.com"
).replace(/\/$/, "")

export const LEGAL = {
  siteUrl: SITE_URL,
  privacyUrl: `${SITE_URL}/privacy`,
  termsUrl: `${SITE_URL}/terms`,
  cancellationUrl: `${SITE_URL}/cancellation-policy`,
  deleteAccountUrl: `${SITE_URL}/delete-account`,
  supportEmail: "support@glammzo.com",
} as const
