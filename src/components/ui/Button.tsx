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
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.primaryFg : colors.coral} />
      ) : (
        <Text
          variant="bodyStrong"
          color={
            variant === "primary"
              ? colors.primaryFg
              : variant === "ghost"
                ? colors.coral
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
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.4,
  },
})

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.coral,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: "transparent",
  },
})
