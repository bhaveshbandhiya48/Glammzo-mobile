import { StyleSheet, TextInput, type TextInputProps, View } from "react-native"

import { Text } from "@/components/ui/Text"
import { colors, radii, spacing, typography } from "@/theme/tokens"

type Props = TextInputProps & {
  label?: string
  hint?: string
  error?: string | null
}

export function Input({ label, hint, error, style, ...rest }: Props) {
  const showError = Boolean(error?.trim())

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" muted>
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={rest.accessibilityLabel ?? label?.replace(/\s*\(required\)$/i, "")}
        accessibilityHint={showError ? error ?? undefined : hint}
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, showError && styles.inputError, style]}
        {...rest}
      />
      {showError ? (
        <Text variant="caption" color={colors.destructive}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.destructive,
    borderWidth: 1.5,
  },
})
