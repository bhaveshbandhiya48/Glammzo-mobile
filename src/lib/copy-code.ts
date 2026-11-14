import * as ReactNative from "react-native"
import { LogBox } from "react-native"

type ClipboardLike = { setString: (value: string) => void }

// RN core's Clipboard is deprecated but still built into the current native
// app, so copying works without a new build. Swap to expo-clipboard with the
// next native build. Its getter warns on every access, so read it once.
LogBox.ignoreLogs(["Clipboard has been extracted from react-native core"])
let clipboard: ClipboardLike | null | undefined

function getClipboard(): ClipboardLike | null {
  if (clipboard === undefined) {
    try {
      clipboard = (ReactNative as unknown as { Clipboard?: ClipboardLike }).Clipboard ?? null
    } catch {
      clipboard = null
    }
  }
  return clipboard
}

/** Copies an offer/referral code. Returns false when the clipboard isn't available. */
export function copyCode(code: string): boolean {
  const value = code.trim()
  if (!value) return false
  try {
    const cb = getClipboard()
    if (!cb) return false
    cb.setString(value)
    return true
  } catch {
    return false
  }
}
