import { useLocalSearchParams, useRouter, type Href } from "expo-router"
import { useRef, useState } from "react"
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { NameOnboarding } from "@/components/auth/NameOnboarding"
import { Logo } from "@/components/brand/Logo"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useFavorites } from "@/context/FavoritesContext"
import { ApiError } from "@/lib/api"
import { requestOtp, verifyOtp } from "@/lib/auth-api"
import { LEGAL } from "@/lib/legal"
import { registerPushTokenWithServer } from "@/lib/push"
import { patchConsumerProfileCache, setDisplayName } from "@/lib/user"
import { colors, radii, spacing, typography } from "@/theme/tokens"

type Step = "phone" | "otp" | "name"

export default function LoginScreen() {
  const router = useRouter()
  const favorites = useFavorites()
  const { next } = useLocalSearchParams<{ next?: string }>()
  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [challengeToken, setChallengeToken] = useState<string | null>(null)
  const [debugOtp, setDebugOtp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const verifyingRef = useRef(false)

  const phoneDigits = phone.replace(/\D/g, "")
  const canSendCode = phoneDigits.length === 10
  const canVerify = otp.trim().length >= 6

  function goHomeOrNext() {
    if (typeof next === "string" && next.startsWith("/")) {
      router.replace(next as Href)
      return
    }
    router.replace("/(tabs)/explore")
  }

  function finishReturningUser() {
    if (typeof next === "string" && next.startsWith("/")) {
      router.replace(next as Href)
    } else if (router.canGoBack()) {
      router.back()
    } else {
      router.replace("/(tabs)/explore")
    }
  }

  function closeLogin() {
    Keyboard.dismiss()
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/explore")
  }

  async function completeReturningUser(existingName: string) {
    await setDisplayName(existingName)
    void registerPushTokenWithServer()
    void favorites.refresh()
    finishReturningUser()
  }

  async function handleContinue() {
    Keyboard.dismiss()
    setError(null)

    if (step === "phone") {
      if (!canSendCode) return
      setLoading(true)
      try {
        const result = await requestOtp(phoneDigits)
        setChallengeToken(result.challengeToken)
        const serverDebugOtp = result.debugOtp?.trim() || null
        if (__DEV__ && serverDebugOtp) {
          setDebugOtp(serverDebugOtp)
          setOtp(serverDebugOtp)
        } else {
          setDebugOtp(null)
          setOtp("")
        }
        setStep("otp")
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not send code.")
      } finally {
        setLoading(false)
      }
      return
    }

    if (step === "otp") {
      if (!canVerify || !challengeToken || verifyingRef.current) return
      verifyingRef.current = true
      setLoading(true)
      try {
        const result = await verifyOtp(challengeToken, otp.trim())
        const sessionPhone =
          result.user?.phone?.trim() || phoneDigits
        await patchConsumerProfileCache({
          phone: sessionPhone,
          name: result.user?.name?.trim() || undefined,
          email: result.user?.email?.trim() || undefined,
        })
        const existingName = result.user?.name?.trim() || ""
        const needsName = result.needsName === true || !existingName
        if (!needsName && existingName) {
          await completeReturningUser(existingName)
        } else {
          // Authenticated first-time user — name onboarding (backend is source of truth).
          setError(null)
          setStep("name")
          void registerPushTokenWithServer()
          void favorites.refresh()
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
          const echoed =
            typeof err.extras.debugOtp === "string" ? err.extras.debugOtp.trim() : ""
          if (__DEV__ && echoed) {
            setDebugOtp(echoed)
            setOtp(echoed)
          }
        } else {
          setError("Could not verify code.")
        }
      } finally {
        setLoading(false)
        verifyingRef.current = false
      }
    }
  }

  if (step === "name") {
    return (
      <NameOnboarding
        onComplete={() => {
          goHomeOrNext()
        }}
      />
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={closeLogin}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.closeBtn}
          >
            <Icon name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <Logo size="lg" />
          </View>

          <Text variant="title" style={styles.title}>
            {step === "phone" ? "Log in" : "Enter OTP"}
          </Text>
          <Text muted style={styles.subtitle}>
            {step === "phone"
              ? "Enter your mobile number to continue"
              : `We sent a code to +91 ${phoneDigits}`}
          </Text>

          <View style={styles.form}>
            {step === "phone" ? (
              <View style={styles.phoneRow}>
                <View style={styles.prefix}>
                  <Text variant="bodyStrong">+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  keyboardType="phone-pad"
                  placeholder="98765 43210"
                  placeholderTextColor={colors.textSubtle}
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={12}
                  textContentType="telephoneNumber"
                  accessibilityLabel="Mobile number"
                />
              </View>
            ) : (
              <TextInput
                style={styles.otpInput}
                keyboardType="number-pad"
                placeholder="6-digit OTP"
                placeholderTextColor={colors.textSubtle}
                value={otp}
                onChangeText={setOtp}
                maxLength={6}
                textContentType="oneTimeCode"
                autoFocus
                accessibilityLabel="One-time password"
              />
            )}
          </View>

          {__DEV__ && debugOtp && step === "otp" ? (
            <Text variant="caption" color={colors.coral} style={styles.gap}>
              Dev OTP: {debugOtp}
            </Text>
          ) : null}
          {error ? (
            <Text variant="caption" color={colors.coral} style={styles.gap}>
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              label={step === "phone" ? "Continue" : "Verify OTP"}
              loading={loading}
              disabled={step === "phone" ? !canSendCode : !canVerify}
              onPress={handleContinue}
            />
            {step === "otp" ? (
              <Button
                label="Change number"
                variant="ghost"
                onPress={() => {
                  Keyboard.dismiss()
                  setOtp("")
                  setDebugOtp(null)
                  setChallengeToken(null)
                  setError(null)
                  setStep("phone")
                }}
              />
            ) : (
              <Text variant="caption" muted style={styles.terms}>
                By continuing, you agree to Glammzo{" "}
                <Text
                  variant="caption"
                  color={colors.coral}
                  onPress={() => void Linking.openURL(LEGAL.termsUrl)}
                >
                  Terms
                </Text>
                {" & "}
                <Text
                  variant="caption"
                  color={colors.coral}
                  onPress={() => void Linking.openURL(LEGAL.privacyUrl)}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    alignItems: "flex-end",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  brand: {
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  title: {
    textAlign: "left",
  },
  subtitle: {
    textAlign: "left",
    marginTop: spacing.sm,
  },
  gap: {
    marginTop: spacing.sm,
  },
  form: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  prefix: {
    paddingHorizontal: spacing.lg,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    height: "100%",
    justifyContent: "center",
    minHeight: 52,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    fontSize: 17,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  otpInput: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
    textAlign: "center",
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  terms: {
    textAlign: "left",
  },
})
