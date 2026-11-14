import { useEffect, useRef, useState } from "react"
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import {
  AuthBackdrop,
  AuthPill,
  AuthRoundButton,
  auth,
  authInput,
  authText,
} from "@/components/auth/AuthUi"
import { Logo } from "@/components/brand/Logo"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { saveDisplayName } from "@/lib/auth-api"
import {
  firstNameFromDisplay,
  normalizeDisplayName,
  validateDisplayName,
} from "@/lib/name-onboarding"
import { saveSignupGender } from "@/lib/signup-gender"
import { setDisplayName, patchConsumerProfileCache, type ConsumerGender } from "@/lib/user"
import { colors, fontFamily, spacing } from "@/theme/tokens"

type Phase = "name" | "gender" | "welcome"

type Props = {
  onComplete: (name: string) => void
}

const MASCOT_NAME = require("../../../assets/brand/glammzo-mascot.png")
const MASCOT_WELCOME = require("../../../assets/brand/glammzo-mascot-welcome.png")

const GENDER_CHOICES: {
  value: ConsumerGender
  label: string
  emoji: string
  bg: string
}[] = [
  { value: "female", label: "Her", emoji: "💁‍♀️", bg: "#FCE4EC" },
  { value: "male", label: "Him", emoji: "💁‍♂️", bg: "#E3EEFB" },
]

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

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <View
      style={styles.progressDots}
      accessible
      accessibilityLabel={`Step ${step} of 2`}
    >
      <View style={[styles.dot, step === 1 && styles.dotActive]} />
      <View style={[styles.dot, step === 2 && styles.dotActive]} />
    </View>
  )
}

function GenderCard({
  label,
  emoji,
  bg,
  selected,
  disabled,
  onPress,
}: {
  label: string
  emoji: string
  bg: string
  selected: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!selected) return
    scale.setValue(0.94)
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 160,
      useNativeDriver: true,
    }).start()
  }, [selected, scale])

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled: Boolean(disabled) }}
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.card,
          selected && styles.cardSelected,
          pressed && !selected && styles.cardPressed,
        ]}
      >
        <View style={[styles.cardCircle, { backgroundColor: bg }]}>
          <Text style={styles.cardEmoji}>{emoji}</Text>
        </View>
        <Text style={styles.cardLabel}>{label}</Text>
        {selected ? (
          <View style={styles.checkBadge} importantForAccessibility="no">
            <Icon name="checkmark" size={14} color={auth.white} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  )
}

/**
 * First-time post-OTP onboarding: name, optional gender, then a short welcome.
 * Returning users with a saved name never reach this component.
 */
export function NameOnboarding({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("name")
  const [rawName, setRawName] = useState("")
  const [savedName, setSavedName] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false)
  const finishingRef = useRef(false)
  const [finishing, setFinishing] = useState(false)
  const [nameFocused, setNameFocused] = useState(false)

  const [gender, setGender] = useState<ConsumerGender | null>(null)
  const [genderSaving, setGenderSaving] = useState(false)

  const stepOpacity = useRef(new Animated.Value(1)).current
  const stepX = useRef(new Animated.Value(0)).current
  const welcomeOpacity = useRef(new Animated.Value(0)).current
  const welcomeY = useRef(new Animated.Value(12)).current
  const welcomeScale = useRef(new Animated.Value(0.96)).current
  const sparkleOpacity = useRef(new Animated.Value(0)).current

  const validation = validateDisplayName(rawName)
  const canSubmit = validation.ok && !loading
  const typedFirst = validation.ok ? firstNameFromDisplay(validation.name) : ""

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

  /** Slide + fade the current step out, swap, then slide the next one in. */
  function goTo(next: Phase, direction: 1 | -1) {
    Animated.parallel([
      Animated.timing(stepOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(stepX, {
        toValue: -28 * direction,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return
      setPhase(next)
      if (next === "welcome") return
      stepX.setValue(28 * direction)
      Animated.parallel([
        Animated.timing(stepOpacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(stepX, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()
    })
  }

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
      goTo("gender", 1)
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

  async function handleSaveGender() {
    if (!gender || genderSaving) return
    setGenderSaving(true)
    await saveSignupGender(gender)
    setGenderSaving(false)
    goTo("welcome", 1)
  }

  function skipGender() {
    if (genderSaving) return
    goTo("welcome", 1)
  }

  const greeting = firstNameFromDisplay(savedName || normalizeDisplayName(rawName))

  function finishWelcome() {
    if (finishingRef.current) return
    finishingRef.current = true
    setFinishing(true)
    stepOpacity.stopAnimation()
    stepX.stopAnimation()
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
      <AuthBackdrop />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {phase === "welcome" ? (
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
              <Text style={[authText.title, styles.welcomeTitle]} accessibilityRole="header">
                Hey, {greeting}! 👋
              </Text>
              <Text style={styles.welcomeBody}>
                Ready to find your next glow-up? ✨
              </Text>
              <AuthPill
                label="Let's Glammzo →"
                loading={finishing}
                disabled={finishing}
                onPress={finishWelcome}
                style={styles.welcomeCta}
                accessibilityLabel="Continue to Glammzo home"
              />
            </Animated.View>
          </View>
        ) : (
          <Animated.View
            style={[styles.flex, { opacity: stepOpacity, transform: [{ translateX: stepX }] }]}
          >
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.topBrand}>
                {phase === "gender" ? (
                  <AuthRoundButton
                    icon="chevron-back"
                    onPress={() => goTo("name", -1)}
                    disabled={genderSaving}
                    accessibilityLabel="Back to your name"
                  />
                ) : (
                  <Logo size="md" />
                )}
                <StepDots step={phase === "name" ? 1 : 2} />
              </View>

              {phase === "name" ? (
                <>
                  <View style={styles.sparkleWrap}>
                    <Mascot variant="name" />
                  </View>

                  <Text style={[authText.title, styles.headline]} accessibilityRole="header">
                    First things first, what do we call you? 👋
                  </Text>
                  <Text style={styles.lead}>
                    We’ll use it for greetings and your bookings.
                  </Text>

                  <TextInput
                    style={[
                      authInput.field,
                      authInput.text,
                      styles.input,
                      nameFocused && authInput.focused,
                      fieldError ? authInput.error : null,
                    ]}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    value={rawName}
                    onChangeText={onChangeName}
                    placeholder="Your name"
                    placeholderTextColor="#8A8A8A"
                    autoFocus={!savedName}
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
                    <Text style={authText.error}>{fieldError}</Text>
                  ) : typedFirst ? (
                    <Text style={styles.reaction} accessibilityLiveRegion="polite">
                      Nice to meet you, {typedFirst}! ✨
                    </Text>
                  ) : null}
                  {submitError ? <Text style={authText.error}>{submitError}</Text> : null}

                  <AuthPill
                    label="Continue"
                    loading={loading}
                    disabled={!canSubmit}
                    onPress={() => void handleSaveName()}
                    style={styles.cta}
                    accessibilityLabel="Save name and continue"
                  />
                </>
              ) : (
                <>
                  <Text style={[authText.title, styles.headline]} accessibilityRole="header">
                    Who are we glamming up, {greeting}? 💅
                  </Text>
                  <Text style={styles.lead}>
                    Helps us show the right services and prices.
                  </Text>

                  <View style={styles.cards} accessibilityRole="radiogroup">
                    {GENDER_CHOICES.map((choice) => (
                      <GenderCard
                        key={choice.value}
                        label={choice.label}
                        emoji={choice.emoji}
                        bg={choice.bg}
                        selected={gender === choice.value}
                        disabled={genderSaving}
                        onPress={() => {
                          setGender(choice.value)
                        }}
                      />
                    ))}
                  </View>

                  <View style={styles.lockRow}>
                    <Icon name="lock-closed-outline" size={12} color={auth.secondary} />
                    <Text style={styles.lockText}>You can’t change this later</Text>
                  </View>

                  <AuthPill
                    label="Let's go"
                    loading={genderSaving}
                    disabled={!gender || genderSaving}
                    onPress={() => void handleSaveGender()}
                    style={styles.cta}
                    accessibilityLabel="Save and continue"
                  />

                  <Pressable
                    onPress={skipGender}
                    disabled={genderSaving}
                    hitSlop={8}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
                  >
                    <Text style={styles.skipText}>Skip for now</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: auth.white,
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
    minHeight: 44,
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
    backgroundColor: auth.text,
    width: 18,
  },
  sparkleWrap: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  headline: {
    textAlign: "left",
    marginBottom: spacing.sm,
  },
  lead: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    color: auth.secondary,
    textAlign: "left",
    marginBottom: spacing.xl,
  },
  input: {
    paddingHorizontal: spacing.lg,
  },
  reaction: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: auth.text,
    marginTop: 10,
  },
  cta: {
    marginTop: spacing.xl,
  },
  cards: {
    flexDirection: "row",
    gap: 12,
  },
  cardWrap: {
    flex: 1,
  },
  card: {
    alignItems: "center",
    paddingVertical: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: auth.inputBorder,
    backgroundColor: auth.white,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: auth.text,
    paddingVertical: 21,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardEmoji: {
    fontSize: 38,
    lineHeight: 46,
  },
  cardLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 22,
    color: auth.text,
  },
  checkBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: auth.text,
    alignItems: "center",
    justifyContent: "center",
  },
  lockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: spacing.md,
  },
  lockText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: auth.secondary,
  },
  skip: {
    alignSelf: "center",
    marginTop: spacing.lg,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipPressed: {
    opacity: 0.6,
  },
  skipText: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: auth.text,
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
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    color: auth.secondary,
    textAlign: "center",
    marginBottom: spacing.xxl,
    maxWidth: 300,
  },
  welcomeCta: {
    minWidth: 240,
    alignSelf: "center",
  },
})
