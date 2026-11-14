import { patchGenderOnApi } from "@/lib/profile-api"
import type { ConsumerGender } from "@/lib/user"

/**
 * Save the gender picked during sign-up. Never throws: a failure is logged and
 * sign-up carries on (the user can still set it later in Edit profile).
 */
export async function saveSignupGender(gender: ConsumerGender): Promise<boolean> {
  try {
    await patchGenderOnApi(gender)
    return true
  } catch (err) {
    console.warn("[signup] gender save failed", err)
    return false
  }
}
