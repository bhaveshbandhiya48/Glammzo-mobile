import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { colors, spacing } from "@/theme/tokens"

type Props = {
  title: string
  /** Optional control on the right (keeps the title centered). */
  right?: ReactNode
}

/**
 * Custom profile stack header — avoids iOS native header button chrome
 * (capsule / rounded-rect liquid-glass behind the chevron).
 */
export function ProfileStackHeader({ title, right }: Props) {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  function goBack() {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace("/(tabs)/profile")
  }

  return (
    <View style={[styles.wrap, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={goBack}
          style={({ pressed }) => [styles.backHit, pressed && styles.pressed]}
        >
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="bodyStrong" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <View style={styles.rightSlot}>{right ?? <View style={styles.sideSpacer} />}</View>
      </View>
    </View>
  )
}

const SIDE = 40

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  backHit: {
    width: SIDE,
    height: SIDE,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.5,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Sora_600SemiBold",
    fontSize: 17,
  },
  rightSlot: {
    minWidth: SIDE,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sideSpacer: {
    width: SIDE,
    height: SIDE,
  },
})
