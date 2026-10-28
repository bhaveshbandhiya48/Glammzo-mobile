import { useLocalSearchParams, useRouter, type Href } from "expo-router"
import { useEffect, useRef, useState } from "react"
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
import { OtpInput } from "@/components/auth/OtpInput"
import { Logo } from "@/components/brand/Logo"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useArtistFavorites } from "@/context/ArtistFavoritesContext"
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
  const artistFavorites = useArtistFavorites()
  const { next } = useLocalSearchParams<{ next?: string }>()
  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [challengeToken, setChallengeToken] = useState<string | null>(null)
  const [debugOtp, setDebugOtp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)
  const verifyingRef = useRef(false)
  const leavingRef = useRef(false)

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = setTimeout(() => setResendSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendSeconds])

  const phoneDigits = phone.replace(/\D/g, "")
  const canSendCode = phoneDigits.length === 10
  const canVerify = otp.trim().length >= 6

  function nextHref(): Href | null {
    if (typeof next === "string" && next.startsWith("/") && !next.startsWith("/login")) {
      return next as Href
    }
    return null
  }

  function syncAfterLogin() {
    requestAnimationFrame(() => {
      void registerPushTokenWithServer().catch(() => undefined)
      void favorites.refresh().catch(() => undefined)
      void artistFavorites.refresh().catch(() => undefined)
    })
  }

  function navigateAfterDismiss(href: Href) {
    requestAnimationFrame(() => {
      try {
        router.navigate(href)
      } catch {
        try {
          router.replace(href)
        } catch {
          // Dismiss already landed on a valid screen.
        }
      }
    })
  }

  /**
   * Login is a modal. Replacing it with `/(tabs)/explore` remounts Home (and
   * the map) on top of the existing tab stack and can crash — especially if
   * a permission prompt is still settling. Dismiss first, then navigate.
   */
  function leaveLogin(mode: "home" | "back") {
    if (leavingRef.current) return
    leavingRef.current = true
    Keyboard.dismiss()

    const dest = nextHref()
    const home = "/(tabs)/explore" as Href

    try {
      if (typeof router.canDismiss === "function" && router.canDismiss()) {
        router.dismiss()
        if (mode === "home") {
          navigateAfterDismiss(dest ?? home)
        } else if (dest) {
          navigateAfterDismiss(dest)
        }
      } else if (mode === "home") {
        router.replace(dest ?? home)
      } else if (dest) {
        router.replace(dest)
      } else if (router.canGoBack()) {
        router.back()
      } else {
        router.replace(home)
      }
    } catch {
      leavingRef.current = false
      try {
        router.replace(home)
      } catch {
        // Stay on login rather than throw out of the press handler.
      }
    }

    syncAfterLogin()
  }

  function closeLogin() {
    Keyboard.dismiss()
    try {
      if (typeof router.canDismiss === "function" && router.canDismiss()) {
        router.dismiss()
      } else if (router.canGoBack()) {
        router.back()
      } else {
        router.replace("/(tabs)/explore")
      }
    } catch {
      router.replace("/(tabs)/explore")
    }
  }

  async function completeReturningUser(existingName: string) {
    await setDisplayName(existingName)
    leaveLogin("back")
  }

  async function sendOtpCode() {
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
    setResendSeconds(30)
    return result
  }

  async function handleResend() {
    if (!canSendCode || resendSeconds > 0 || resending || loading) return
    Keyboard.dismiss()
    setError(null)
    setResending(true)
    try {
      await sendOtpCode()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend code.")
    } finally {
      setResending(false)
    }
  }

  async function handleContinue() {
    Keyboard.dismiss()
    setError(null)

    if (step === "phone") {
      if (!canSendCode) return
      setLoading(true)
      try {
        await sendOtpCode()
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
          leaveLogin("home")
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
              <OtpInput
                value={otp}
                onChange={setOtp}
                length={6}
                autoFocus
                accessibilityLabel="One-time password"
              />
            )}
          </View>

          {__DEV__ && debugOtp && step === "otp" ? (
            <Text variant="caption" color={colors.primary} style={styles.gap}>
              Dev OTP: {debugOtp}
            </Text>
          ) : null}
          {error ? (
            <Text variant="caption" color={colors.primary} style={styles.gap}>
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              label={step === "phone" ? "Continue" : "Verify OTP"}
              loading={loading}
              disabled={
                step === "phone" ? !canSendCode : !canVerify || resending
              }
              onPress={handleContinue}
            />
            {step === "otp" ? (
              <>
                <Button
                  label={
                    resending
                      ? "Sending…"
                      : resendSeconds > 0
                        ? `Resend code in ${resendSeconds}s`
                        : "Resend code"
                  }
                  variant="ghost"
                  loading={resending}
                  disabled={resendSeconds > 0 || loading}
                  onPress={() => void handleResend()}
                />
                <Button
                  label="Change number"
                  variant="ghost"
                  disabled={loading || resending}
                  onPress={() => {
                    Keyboard.dismiss()
                    setOtp("")
                    setDebugOtp(null)
                    setChallengeToken(null)
                    setError(null)
                    setResendSeconds(0)
                    setStep("phone")
                  }}
                />
              </>
            ) : (
              <Text variant="caption" muted style={styles.terms}>
                By continuing, you agree to Glammzo{" "}
                <Text
                  variant="caption"
                  color={colors.primary}
                  onPress={() => void Linking.openURL(LEGAL.termsUrl)}
                >
                  Terms
                </Text>
                {" & "}
                <Text
                  variant="caption"
                  color={colors.primary}
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
  actions: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  terms: {
    textAlign: "left",
  },
})
