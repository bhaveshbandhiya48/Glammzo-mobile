/** @deprecated Hardcoded WLCM200 launch offer retired — use CMS Glammzo offers. */

export const LAUNCH_PROMO_CODE = "WLCM200"

export const LAUNCH_CASHBACK_RUPEES = 200

export const LAUNCH_CASHBACK_MIN_RUPEES = 699

export const LAUNCH_PROMO_TITLE = "Launch offer — ₹200 cashback"

export const LAUNCH_PROMO_SUBTITLE =
  "₹200 wallet cashback after your first completed visit"

export function isLaunchPromoCode(code: string) {
  return code.trim().toUpperCase() === LAUNCH_PROMO_CODE
}
