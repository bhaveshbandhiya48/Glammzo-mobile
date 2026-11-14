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
import {
  AuthBackdrop,
  AuthFooter,
  AuthHero,
  AuthPill,
  AuthRoundButton,
  auth,
  authInput,
  authText,
} from "@/components/auth/AuthUi"
import { OtpInput } from "@/components/auth/OtpInput"
import { Logo } from "@/components/brand/Logo"
import { Text } from "@/components/ui/Text"
import { useArtistFavorites } from "@/context/ArtistFavoritesContext"
import { useFavorites } from "@/context/FavoritesContext"
import { ApiError, SERVER_UNREACHABLE_MESSAGE } from "@/lib/api"
import { requestOtp, verifyOtp } from "@/lib/auth-api"
import { API_URL } from "@/lib/config"
import { LEGAL } from "@/lib/legal"
import { registerPushTokenWithServer } from "@/lib/push"
import { patchConsumerProfileCache, setDisplayName } from "@/lib/user"
import { fontFamily } from "@/theme/tokens"

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
  const [phoneFocused, setPhoneFocused] = useState(false)
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
        setError(
          err instanceof ApiError
            ? err.message
            : __DEV__
              ? `Can't reach ${API_URL}. Is Glammzo-web on :4008? ${
                  err instanceof Error ? err.message : ""
                }`.trim()
              : SERVER_UNREACHABLE_MESSAGE,
        )
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
          // Usually unreachable API (stale LAN IP / simulator host) — not a wrong OTP.
          setError(
            __DEV__
              ? `Can't reach ${API_URL}. Is Glammzo-web on :4008? ${
                  err instanceof Error ? err.message : ""
                }`.trim()
              : SERVER_UNREACHABLE_MESSAGE,
          )
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

  function changeNumber() {
    Keyboard.dismiss()
    setOtp("")
    setDebugOtp(null)
    setChallengeToken(null)
    setError(null)
    setResendSeconds(0)
    setStep("phone")
  }

  const maskedPhone =
    phoneDigits.length >= 4
      ? `${phoneDigits.slice(0, 2)}xxx xxx${phoneDigits.slice(-2)}`
      : phoneDigits
  const resendClock = `${Math.floor(resendSeconds / 60)}:${String(resendSeconds % 60).padStart(2, "0")}`

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <AuthBackdrop />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.topBar}>
          {step === "phone" ? (
            <Logo size="md" />
          ) : (
            <AuthRoundButton
              icon="chevron-back"
              onPress={changeNumber}
              disabled={loading || resending}
              accessibilityLabel="Back to mobile number"
            />
          )}
          <AuthRoundButton icon="close" onPress={closeLogin} accessibilityLabel="Close" />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {step === "phone" ? (
            <>
              <AuthHero />
              <Text style={authText.title} accessibilityRole="header">
                Book beauty near you
              </Text>
              <Text style={authText.subtitle}>Log in or sign up with your mobile number.</Text>

              <View
                style={[
                  authInput.field,
                  styles.phoneRow,
                  phoneFocused && authInput.focused,
                  error ? authInput.error : null,
                ]}
              >
                <View style={styles.prefix}>
                  <Text style={authInput.text}>+91</Text>
                </View>
                <View style={styles.divider} />
                <TextInput
                  style={[authInput.text, styles.phoneInput]}
                  keyboardType="phone-pad"
                  placeholder="98765 43210"
                  placeholderTextColor="#8A8A8A"
                  value={phone}
                  onChangeText={setPhone}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                  maxLength={12}
                  textContentType="telephoneNumber"
                  accessibilityLabel="Mobile number"
                />
              </View>
            </>
          ) : (
            <>
              <Text style={[authText.titleSm, styles.otpTitle]} accessibilityRole="header">
                Enter the code
              </Text>
              <Text style={authText.subtitle}>
                Sent to +91 {maskedPhone}
                {" · "}
                <Text
                  style={styles.inlineLink}
                  onPress={loading || resending ? undefined : changeNumber}
                  accessibilityRole="button"
                  accessibilityLabel="Edit mobile number"
                >
                  Edit
                </Text>
              </Text>

              <View style={styles.otpWrap}>
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  length={6}
                  autoFocus
                  error={Boolean(error)}
                  accessibilityLabel="One-time password"
                />
              </View>

              <View style={styles.resendRow}>
                {resending ? (
                  <Text style={styles.resendMuted}>Sending…</Text>
                ) : resendSeconds > 0 ? (
                  <Text style={styles.resendMuted}>Resend code in {resendClock}</Text>
                ) : (
                  <Pressable
                    onPress={() => void handleResend()}
                    disabled={loading}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: loading }}
                  >
                    <Text style={[styles.resendLink, loading && styles.resendDisabled]}>
                      Resend code
                    </Text>
                  </Pressable>
                )}
              </View>
            </>
          )}

          {error ? <Text style={authText.error}>{error}</Text> : null}
          {__DEV__ ? (
            <Text variant="caption" muted style={styles.gap}>
              API: {API_URL}
            </Text>
          ) : null}
          {__DEV__ && debugOtp && step === "otp" ? (
            <Text variant="caption" style={styles.gap}>
              Dev OTP: {debugOtp}
            </Text>
          ) : null}
        </ScrollView>

        <AuthFooter>
          <AuthPill
            label={step === "phone" ? "Continue" : "Verify"}
            accessibilityLabel={step === "phone" ? "Continue" : "Verify OTP"}
            loading={loading}
            disabled={step === "phone" ? !canSendCode : !canVerify || resending}
            onPress={handleContinue}
          />
          {step === "phone" ? (
            <Text style={authText.legal}>
              By continuing, you agree to Glammzo{" "}
              <Text style={authText.link} onPress={() => void Linking.openURL(LEGAL.termsUrl)}>
                Terms
              </Text>
              {" & "}
              <Text style={authText.link} onPress={() => void Linking.openURL(LEGAL.privacyUrl)}>
                Privacy Policy
              </Text>
              .
            </Text>
          ) : null}
        </AuthFooter>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    minHeight: 48,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  gap: {
    marginTop: 8,
  },
  phoneRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  prefix: {
    paddingLeft: 16,
    paddingRight: 12,
    justifyContent: "center",
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: auth.inputBorder,
  },
  phoneInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 12,
  },
  otpTitle: {
    marginTop: 20,
  },
  inlineLink: {
    fontFamily: fontFamily.semibold,
    color: auth.text,
    textDecorationLine: "underline",
  },
  otpWrap: {
    marginTop: 28,
  },
  resendRow: {
    marginTop: 20,
    alignItems: "flex-start",
  },
  resendMuted: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: auth.secondary,
  },
  resendLink: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: auth.text,
    textDecorationLine: "underline",
  },
  resendDisabled: {
    color: auth.disabled,
  },
})
