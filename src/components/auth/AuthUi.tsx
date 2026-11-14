import type { ReactNode } from "react"
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

/** Login-flow palette (matches the Home header style). */
export const auth = {
  text: "#111111",
  secondary: "#595959",
  inputBg: "#FAFAFA",
  inputBorder: "#E3E3E3",
  focus: "#111111",
  error: "#C0392B",
  disabled: "#D4D4D4",
  white: "#FFFFFF",
  gradient: ["#fdf3ee", "#ffffff"],
} as const

/** Peach-to-white wash behind the top of an auth screen. Render first. */
export function AuthBackdrop() {
  return (
    <View style={styles.backdrop} pointerEvents="none">
      <GradientFill colors={[...auth.gradient]} angle={180} />
    </View>
  )
}

type PillProps = PressableProps & {
  label: string
  loading?: boolean
  style?: StyleProp<ViewStyle>
}

/** Full-width black pill, 52 tall. */
export function AuthPill({ label, loading = false, disabled, style, ...rest }: PillProps) {
  const isDisabled = Boolean(disabled || loading)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rest.accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.pill,
        pressed && !isDisabled && styles.pillPressed,
        isDisabled && !loading && styles.pillDisabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={auth.white} />
      ) : (
        <Text style={styles.pillLabel}>{label}</Text>
      )}
    </Pressable>
  )
}

type RoundButtonProps = {
  icon: IconName
  onPress: () => void
  accessibilityLabel: string
  disabled?: boolean
}

/** Round white icon button (back / close). */
export function AuthRoundButton({ icon, onPress, accessibilityLabel, disabled }: RoundButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}
    >
      <Icon name={icon} size={20} color={auth.text} />
    </Pressable>
  )
}

const HERO_CIRCLES: { icon: IconName; bg: string; fg: string; style: ViewStyle }[] = [
  { icon: "cut-outline", bg: "#FCE3D6", fg: "#9A4A2A", style: { left: 0, top: 18 } },
  { icon: "brush-outline", bg: "#E8E2FA", fg: "#5B3CC4", style: { left: 62, top: 0, zIndex: 2 } },
  { icon: "sparkles-outline", bg: "#DDF1E4", fg: "#146C2E", style: { left: 124, top: 18 } },
]

/** Soft decorative visual: three overlapping pastel circles with service icons. */
export function AuthHero() {
  return (
    <View
      style={styles.hero}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {HERO_CIRCLES.map((circle) => (
        <View
          key={circle.icon}
          style={[styles.heroCircle, { backgroundColor: circle.bg }, circle.style]}
        >
          <Icon name={circle.icon} size={30} color={circle.fg} />
        </View>
      ))}
    </View>
  )
}

/** Pinned footer area (sits above the keyboard inside a KeyboardAvoidingView). */
export function AuthFooter({ children }: { children: ReactNode }) {
  return <View style={styles.footer}>{children}</View>
}

export const authText = StyleSheet.create({
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    color: auth.text,
    letterSpacing: -0.3,
  },
  titleSm: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
    color: auth.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: auth.secondary,
    marginTop: 6,
  },
  legal: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: auth.secondary,
    textAlign: "center",
  },
  link: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: auth.text,
    textDecorationLine: "underline",
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: auth.error,
    marginTop: 8,
  },
})

export const authInput = StyleSheet.create({
  field: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: auth.inputBorder,
    backgroundColor: auth.inputBg,
  },
  focused: {
    borderColor: auth.focus,
  },
  error: {
    borderColor: auth.error,
  },
  text: {
    fontFamily: fontFamily.medium,
    fontSize: 17,
    color: auth.text,
  },
})

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  pill: {
    height: 52,
    borderRadius: 999,
    backgroundColor: auth.text,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    alignSelf: "stretch",
  },
  pillPressed: {
    backgroundColor: "#2B2B2B",
  },
  pillDisabled: {
    backgroundColor: auth.disabled,
  },
  pillLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: auth.white,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: auth.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  roundPressed: {
    backgroundColor: "#F2F2F2",
  },
  hero: {
    width: 196,
    height: 90,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 28,
  },
  heroCircle: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: auth.white,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
})
