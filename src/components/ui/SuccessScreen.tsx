import { Stack } from "expo-router"
import { useEffect, useRef, type ReactNode } from "react"
import { Animated, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { colors, radii, spacing, status as tint } from "@/theme/tokens"

type Action = { label: string; onPress: () => void }

type Props = {
  title: string
  message: string
  /** What was just done, shown in a card under the message. */
  children?: ReactNode
  primary: Action
  secondary?: Action
}

/** Full-screen "that worked" moment: an animated tick, a summary card and what to do next. */
export function SuccessScreen({ title, message, children, primary, secondary }: Props) {
  const insets = useSafeAreaInsets()
  const scale = useRef(new Animated.Value(0.6)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }, [opacity, scale])

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.tick, { opacity, transform: [{ scale }] }]}>
          <Icon name="checkmark" size={40} color={tint.successFg} />
        </Animated.View>
        <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.center}>
          {title}
        </Text>
        <Text muted style={[styles.center, styles.message]}>
          {message}
        </Text>
        {children ? <View style={styles.card}>{children}</View> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Button label={primary.label} onPress={primary.onPress} />
        {secondary ? <Button label={secondary.label} variant="secondary" onPress={secondary.onPress} /> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  tick: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tint.successBg,
    marginBottom: spacing.md,
  },
  center: {
    textAlign: "center",
  },
  message: {
    maxWidth: 300,
  },
  card: {
    alignSelf: "stretch",
    marginTop: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
})
