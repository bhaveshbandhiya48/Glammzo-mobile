import { Text as RNText, type TextProps, type TextStyle } from "react-native"

import { colors, typography } from "@/theme/tokens"

type Variant = keyof typeof typography

type Props = TextProps & {
  variant?: Variant
  muted?: boolean
  color?: string
}

export function Text({ variant = "body", muted = false, color, style, ...rest }: Props) {
  const variantStyle = typography[variant] as TextStyle
  return (
    <RNText
      style={[
        variantStyle,
        { color: color ?? (muted ? colors.textMuted : colors.text) },
        style,
      ]}
      {...rest}
    />
  )
}
