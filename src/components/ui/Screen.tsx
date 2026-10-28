import type { ReactNode, RefObject } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
  type ScrollViewInstance,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { colors, spacing } from "@/theme/tokens"

type Props = {
  children: ReactNode
  scroll?: boolean
  padded?: boolean
  edges?: ("top" | "right" | "bottom" | "left")[]
  style?: ViewStyle
  contentStyle?: StyleProp<ViewStyle>
  /** Lift content above the keyboard. */
  keyboardAvoiding?: boolean
  keyboardVerticalOffset?: number
  scrollRef?: RefObject<ScrollViewInstance | null>
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ["left", "right"],
  style,
  contentStyle,
  keyboardAvoiding = false,
  keyboardVerticalOffset = Platform.OS === "ios" ? 64 : 0,
  scrollRef,
}: Props) {
  const pad = padded ? styles.padded : null

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.scrollContent, pad, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, pad, contentStyle]}>{children}</View>
  )

  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
  },
  padded: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
})
