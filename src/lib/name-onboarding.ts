/** Normalize and validate first-time display names. */

const NAME_MIN = 2
const NAME_MAX = 40
/** Letters (basic Latin + common accents), spaces, apostrophe, hyphen, period. */
const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s'.-]*$/

export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

export function validateDisplayName(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  const name = normalizeDisplayName(raw)
  if (!name) {
    return { ok: false, message: "Please enter your name." }
  }
  if (name.length < NAME_MIN) {
    return { ok: false, message: "Name is a bit short — try at least 2 characters." }
  }
  if (name.length > NAME_MAX) {
    return { ok: false, message: "Please keep your name under 40 characters." }
  }
  if (!NAME_PATTERN.test(name)) {
    return { ok: false, message: "Use letters only — no numbers or special symbols." }
  }
  return { ok: true, name }
}

export function firstNameFromDisplay(name: string): string {
  const part = normalizeDisplayName(name).split(" ")[0]
  return part || name
}
