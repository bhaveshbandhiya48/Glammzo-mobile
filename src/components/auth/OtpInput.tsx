import { useEffect, useRef } from "react"
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type TextInputInstance,
} from "react-native"

import { Text } from "@/components/ui/Text"
import { colors, radii, spacing, typography } from "@/theme/tokens"

type Props = {
  value: string
  onChange: (value: string) => void
  length?: number
  autoFocus?: boolean
  accessibilityLabel?: string
  textContentType?: TextInputProps["textContentType"]
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  accessibilityLabel = "One-time password",
  textContentType = "oneTimeCode",
}: Props) {
  const inputRef = useRef<TextInputInstance>(null)
  const digits = value.replace(/\D/g, "").slice(0, length)
  const activeIndex = Math.min(digits.length, length - 1)

  useEffect(() => {
    if (!autoFocus) return
    const timer = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [autoFocus])

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="none"
      style={styles.wrap}
    >
      <View style={styles.boxes} pointerEvents="none">
        {Array.from({ length }, (_, index) => {
          const char = digits[index] ?? ""
          const focused = activeIndex === index
          return (
            <View
              key={index}
              style={[
                styles.box,
                Boolean(char) && styles.boxFilled,
                focused && styles.boxFocused,
              ]}
            >
              <Text variant="heading" style={styles.digit}>
                {char}
              </Text>
              {!char && focused ? <View style={styles.caret} /> : null}
            </View>
          )
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={(next) => onChange(next.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        textContentType={textContentType}
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        style={styles.hiddenInput}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  boxes: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    minWidth: 44,
    maxWidth: 56,
    aspectRatio: 0.92,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxFilled: {
    borderColor: "#E8C4BC",
    backgroundColor: "#FFF7F5",
  },
  boxFocused: {
    borderColor: colors.coral,
    borderWidth: 1.5,
  },
  digit: {
    fontSize: 22,
    fontFamily: typography.heading.fontFamily,
  },
  caret: {
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: colors.coral,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.02,
    color: "transparent",
  },
})
