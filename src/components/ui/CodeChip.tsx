import { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { copyCode } from "@/lib/copy-code"
import { fontFamily } from "@/theme/tokens"

type Tone = "light" | "dark" | "white"

type Props = {
  code: string
  /** Small text before the code, e.g. "Code". */
  label?: string
  /** light: on white cards · dark: on the black offer cards · white: floating over images. */
  tone?: Tone
  style?: StyleProp<ViewStyle>
}

const TONES: Record<Tone, { bg: string; border: string; text: string; muted: string; done: string }> = {
  light: { bg: "#ffffff", border: "#bdbdbd", text: "#111111", muted: "#595959", done: "#17633e" },
  dark: { bg: "transparent", border: "rgba(255,255,255,0.55)", text: "#ffffff", muted: "rgba(255,255,255,0.75)", done: "#ffffff" },
  white: { bg: "#ffffff", border: "#e3e3e3", text: "#111111", muted: "#595959", done: "#17633e" },
}

/** Dashed code chip; tap copies the code and shows "Copied" for 1.5s. */
export function CodeChip({ code, label, tone = "light", style }: Props) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t = TONES[tone]

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function onPress() {
    if (!copyCode(code)) return
    setCopied(true)
    AccessibilityInfo.announceForAccessibility(`Code ${code} copied`)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Copy code ${code}`}
      accessibilityState={{ selected: copied }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: t.bg, borderColor: t.border },
        tone === "white" && styles.floating,
        pressed && styles.pressed,
        style,
      ]}
    >
      {label ? <Text style={[styles.label, { color: t.muted }]}>{label}</Text> : null}
      <Text style={[styles.code, { color: t.text }]} numberOfLines={1}>
        {code}
      </Text>
      <View style={styles.action}>
        <Icon name={copied ? "checkmark-circle" : "copy-outline"} size={14} color={copied ? t.done : t.text} />
        {copied ? <Text style={[styles.copied, { color: t.done }]}>Copied</Text> : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: "dashed",
    maxWidth: "100%",
  },
  floating: {
    borderStyle: "solid",
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  pressed: { opacity: 0.7 },
  label: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  code: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 17, letterSpacing: 1.2, flexShrink: 1 },
  action: { flexDirection: "row", alignItems: "center", gap: 3 },
  copied: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16 },
})
