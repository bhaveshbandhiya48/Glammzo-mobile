import { useEffect, useRef, useState } from "react"
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Logo } from "@/components/brand/Logo"
import { Button } from "@/components/ui/Button"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { saveDisplayName } from "@/lib/auth-api"
import {
  firstNameFromDisplay,
  normalizeDisplayName,
  validateDisplayName,
} from "@/lib/name-onboarding"
import { setDisplayName, patchConsumerProfileCache } from "@/lib/user"
import { colors, radii, spacing, typography } from "@/theme/tokens"

type Phase = "ask" | "welcome"

type Props = {
  onComplete: (name: string) => void
}

const ONBOARDING_BG = "#FAF3EF"
const MASCOT_NAME = require("../../../assets/brand/glammzo-mascot.png")
const MASCOT_WELCOME = require("../../../assets/brand/glammzo-mascot-welcome.png")

function Mascot({
  size = 148,
  variant = "name",
}: {
  size?: number
  variant?: "name" | "welcome"
}) {
  return (
    <Image
      source={variant === "welcome" ? MASCOT_WELCOME : MASCOT_NAME}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="Glammzo mascot"
    />
  )
}

/**
 * First-time post-OTP name capture + short personalized welcome.
 * Returning users with a saved name never reach this component.
 */
export function NameOnboarding({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("ask")
  const [rawName, setRawName] = useState("")
  const [savedName, setSavedName] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false)
  const finishingRef = useRef(false)
  const [finishing, setFinishing] = useState(false)

  const askOpacity = useRef(new Animated.Value(1)).current
  const welcomeOpacity = useRef(new Animated.Value(0)).current
  const welcomeY = useRef(new Animated.Value(12)).current
  const welcomeScale = useRef(new Animated.Value(0.96)).current
  const sparkleOpacity = useRef(new Animated.Value(0)).current

  const validation = validateDisplayName(rawName)
  const canSubmit = validation.ok && !loading

  useEffect(() => {
    if (phase !== "welcome") return
    Animated.parallel([
      Animated.timing(sparkleOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(welcomeOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(welcomeY, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(welcomeScale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start()
  }, [phase, sparkleOpacity, welcomeOpacity, welcomeScale, welcomeY])

  function onChangeName(value: string) {
    setRawName(value)
    setSubmitError(null)
    if (fieldError) {
      const next = validateDisplayName(value)
      setFieldError(next.ok ? null : next.message)
    }
  }

  async function handleSaveName() {
    Keyboard.dismiss()
    setSubmitError(null)

    const checked = validateDisplayName(rawName)
    if (!checked.ok) {
      setFieldError(checked.message)
      return
    }
    setFieldError(null)

    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)

    try {
      const result = await saveDisplayName(checked.name)
      const finalName = result.name?.trim() || checked.name
      await setDisplayName(finalName)
      await patchConsumerProfileCache({ name: finalName })
      setSavedName(finalName)

      Animated.timing(askOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setPhase("welcome")
      })
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Couldn’t save your name. Check your connection and try again.",
      )
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  const greeting = firstNameFromDisplay(savedName || normalizeDisplayName(rawName))

  function finishWelcome() {
    if (finishingRef.current) return
    finishingRef.current = true
    setFinishing(true)
    askOpacity.stopAnimation()
    welcomeOpacity.stopAnimation()
    welcomeY.stopAnimation()
    welcomeScale.stopAnimation()
    sparkleOpacity.stopAnimation()
    requestAnimationFrame(() => {
      onComplete(savedName || greeting)
    })
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {phase === "ask" ? (
          <Animated.View style={[styles.flex, { opacity: askOpacity }]}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.topBrand}>
                <Logo size="md" />
                <View style={styles.progressDots} accessibilityLabel="Step 1 of 2">
                  <View style={[styles.dot, styles.dotActive]} />
                  <View style={styles.dot} />
                </View>
              </View>

              <View style={styles.sparkleWrap}>
                <Mascot variant="name" />
              </View>

              <Text
                variant="title"
                style={styles.headline}
                accessibilityRole="header"
              >
                You&apos;re verified! 🎉
              </Text>
              <Text style={styles.lead}>
                We know your number.{"\n"}
                But what should we call you? 👀
              </Text>

              <TextInput
                style={[styles.input, fieldError ? styles.inputError : null]}
                value={rawName}
                onChangeText={onChangeName}
                placeholder="Your name"
                placeholderTextColor={colors.textSubtle}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
                returnKeyType="done"
                maxLength={48}
                editable={!loading}
                onSubmitEditing={() => {
                  if (canSubmit) void handleSaveName()
                }}
                accessibilityLabel="Your name"
                accessibilityHint="Enter the name we should use for greetings and bookings"
              />

              {fieldError ? (
                <Text variant="caption" color={colors.destructive} style={styles.error}>
                  {fieldError}
                </Text>
              ) : null}
              {submitError ? (
                <Text variant="caption" color={colors.destructive} style={styles.error}>
                  {submitError}
                </Text>
              ) : null}

              <Button
                label="That's me ✨"
                loading={loading}
                disabled={!canSubmit}
                onPress={() => void handleSaveName()}
                style={styles.cta}
                accessibilityLabel="Save name and continue"
              />

              <Text variant="caption" muted style={styles.foot}>
                We’ll use this for greetings and your bookings.
              </Text>
            </ScrollView>
          </Animated.View>
        ) : (
          <View style={styles.welcomeRoot}>
            <Animated.View style={[styles.welcomeSparkle, { opacity: sparkleOpacity }]}>
              <Mascot variant="welcome" size={168} />
            </Animated.View>

            <Animated.View
              style={{
                opacity: welcomeOpacity,
                transform: [{ translateY: welcomeY }, { scale: welcomeScale }],
                alignItems: "center",
                paddingHorizontal: spacing.xl,
              }}
            >
              <Text
                variant="title"
                style={styles.welcomeTitle}
                accessibilityRole="header"
              >
                Hey, {greeting}! 👋
              </Text>
              <Text style={styles.welcomeBody}>
                Ready to find your next glow-up? ✨
              </Text>
              <Button
                label="Let's Glammzo →"
                loading={finishing}
                disabled={finishing}
                onPress={finishWelcome}
                style={styles.welcomeCta}
                accessibilityLabel="Continue to Glammzo home"
              />
            </Animated.View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ONBOARDING_BG,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  topBrand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  progressDots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.sand,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 18,
  },
  sparkleWrap: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  headline: {
    textAlign: "left",
    marginBottom: spacing.md,
  },
  lead: {
    fontFamily: typography.body.fontFamily,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textMuted,
    textAlign: "left",
    marginBottom: spacing.xxl,
  },
  input: {
    minHeight: 56,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.destructive,
  },
  error: {
    marginTop: spacing.sm,
  },
  cta: {
    marginTop: spacing.xl,
  },
  foot: {
    marginTop: spacing.lg,
    textAlign: "center",
  },
  welcomeRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  welcomeSparkle: {
    marginBottom: spacing.xl,
  },
  welcomeTitle: {
    textAlign: "center",
    marginBottom: spacing.md,
  },
  welcomeBody: {
    fontFamily: typography.body.fontFamily,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xxl,
    maxWidth: 300,
  },
  welcomeCta: {
    minWidth: 220,
  },
})
