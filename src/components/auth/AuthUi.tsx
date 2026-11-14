import { useEffect, useRef, type ReactNode } from "react"
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import { ServiceTileIcon } from "@/components/home/ServiceTileIcon"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { getServiceTile, type ServiceTile, type ServiceTileKey } from "@/lib/service-tiles"
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

const HERO_TILE_KEYS: ServiceTileKey[] = ["haircut", "makeup", "nails", "spa"]
const HERO_TILES = HERO_TILE_KEYS.map((key) => getServiceTile(key)).filter(
  (tile): tile is ServiceTile => Boolean(tile),
)
const TILE = 68
const TILE_STEP = 50
const HERO_HEIGHT = 106
const HERO_FAN: { rotate: string; top: number }[] = [
  { rotate: "-10deg", top: 18 },
  { rotate: "-3deg", top: 6 },
  { rotate: "4deg", top: 10 },
  { rotate: "11deg", top: 22 },
]

/**
 * Playful fanned stack of the Home service tiles. Rises in once; folds away
 * while the keyboard is open so the phone field and Continue stay visible.
 */
export function AuthHero() {
  const entrance = useRef(HERO_TILES.map(() => new Animated.Value(0))).current
  const fold = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.stagger(
      80,
      entrance.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start()
  }, [entrance])

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const animate = (toValue: number) =>
      Animated.timing(fold, {
        toValue,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start()
    const show = Keyboard.addListener(showEvent, () => animate(0))
    const hide = Keyboard.addListener(hideEvent, () => animate(1))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [fold])

  return (
    <Animated.View
      style={[
        styles.heroFold,
        {
          height: fold.interpolate({ inputRange: [0, 1], outputRange: [0, HERO_HEIGHT] }),
          marginBottom: fold.interpolate({ inputRange: [0, 1], outputRange: [4, 24] }),
          opacity: fold,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.hero, { width: TILE + TILE_STEP * (HERO_TILES.length - 1) }]}>
        {HERO_TILES.map((tile, index) => {
          const fan = HERO_FAN[index] ?? HERO_FAN[0]
          const value = entrance[index]
          return (
            <Animated.View
              key={tile.key}
              style={[
                styles.heroTile,
                {
                  left: index * TILE_STEP,
                  top: fan.top,
                  zIndex: index === 1 || index === 2 ? 2 : 1,
                  backgroundColor: tile.gradient[1],
                  opacity: value,
                  transform: [
                    {
                      translateY: value.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
                    },
                    { rotate: fan.rotate },
                  ],
                },
              ]}
            >
              <GradientFill colors={tile.gradient} angle={150} radius={20} />
              <ServiceTileIcon tile={tile} size={34} />
            </Animated.View>
          )
        })}
      </View>
    </Animated.View>
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
  heroFold: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 8,
  },
  hero: {
    height: HERO_HEIGHT,
  },
  heroTile: {
    position: "absolute",
    width: TILE,
    height: TILE,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: auth.white,
    shadowColor: "#3b2a24",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
})
