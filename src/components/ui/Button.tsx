import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
} from "react-native"

import { Text } from "@/components/ui/Text"
import { colors, radii, spacing } from "@/theme/tokens"

type Variant = "primary" | "secondary" | "ghost"

type Props = PressableProps & {
  label: string
  variant?: Variant
  loading?: boolean
  style?: ViewStyle
}

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      accessibilityLabel={rest.accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(isDisabled), busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !isDisabled && (variant === "primary" ? styles.pressedPrimary : styles.pressed),
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.primaryFg : colors.primary} />
      ) : (
        <Text
          variant="bodyStrong"
          color={
            variant === "primary"
              ? colors.primaryFg
              : variant === "ghost"
                ? colors.primary
                : colors.text
          }
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.muted,
  },
  pressedPrimary: {
    backgroundColor: colors.primaryPressed,
  },
  disabled: {
    opacity: 0.35,
  },
})

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  ghost: {
    backgroundColor: "transparent",
  },
})
