import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewInstance,
  type TextInputProps,
} from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GradientFill } from "@/components/home/GradientFill"
import { pastelForName } from "@/components/home/PhotoFallback"
import { sp, ui } from "@/components/salon-page/theme"
import { Button } from "@/components/ui/Button"
import { DateOfBirthField } from "@/components/ui/DateOfBirthField"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import {
  deleteAccountOnApi,
  loadProfilePreferApi,
  patchProfileOnApi,
} from "@/lib/profile-api"
import { getAccessToken } from "@/lib/session"
import {
  CONSUMER_GENDER_OPTIONS,
  clearLocalSession,
  genderLabel,
  validateConsumerProfileFields,
  type ConsumerGender,
  type ConsumerProfile,
  type ConsumerProfileFieldErrors,
} from "@/lib/user"
import { colors, fontFamily, radii, spacing } from "@/theme/tokens"

const CONFIRM_WORD = "DELETE"
const ERROR = "#c0392b"
const SUCCESS = "#17633e"
const LOCKED = "#8a8a8a"
const FIELD_BG = "#fafafa"
const DISABLED = "#d4d4d4"

const EMPTY_PROFILE: ConsumerProfile = {
  name: "",
  email: "",
  phone: "",
  gender: "",
  dateOfBirth: "",
  address: "",
}

const EDITABLE_KEYS = ["name", "email", "gender", "dateOfBirth", "address"] as const

function sameEditable(a: ConsumerProfile, b: ConsumerProfile) {
  return EDITABLE_KEYS.every((key) => a[key] === b[key])
}

export default function ProfileDetailsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const addressFocusedRef = useRef(false)
  const [profile, setProfile] = useState<ConsumerProfile>(EMPTY_PROFILE)
  /** Last loaded or saved values; Save stays off until something differs. */
  const [baseline, setBaseline] = useState<ConsumerProfile | null>(null)
  const [fieldErrors, setFieldErrors] = useState<ConsumerProfileFieldErrors>({})
  /** Gender becomes read-only after it has been saved once. */
  const [genderLocked, setGenderLocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        const token = await getAccessToken()
        if (!token) {
          router.replace({
            pathname: "/login",
            params: { next: "/profile/details" },
          })
          return
        }
        const value = await loadProfilePreferApi()
        if (active) {
          setProfile(value)
          setBaseline(value)
          setGenderLocked(Boolean(value.gender.trim()))
          setFieldErrors({})
        }
      })()
      return () => {
        active = false
      }
    }, [router]),
  )

  function update<K extends keyof ConsumerProfile>(key: K, value: ConsumerProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }))
    setMessage(null)
    setError(null)
    if (key in { name: 1, email: 1, dateOfBirth: 1, address: 1, gender: 1 }) {
      setFieldErrors((prev) => {
        if (!prev[key as keyof ConsumerProfileFieldErrors]) return prev
        const next = { ...prev }
        delete next[key as keyof ConsumerProfileFieldErrors]
        return next
      })
    }
  }

  function scrollAddressIntoView() {
    requestAnimationFrame(() => {
      setTimeout(
        () => {
          if (addressFocusedRef.current) {
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        },
        Platform.OS === "ios" ? 80 : 200,
      )
    })
  }

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const sub = Keyboard.addListener(showEvent, () => {
      if (addressFocusedRef.current) scrollAddressIntoView()
    })
    return () => sub.remove()
  }, [])

  function closeDeleteModal() {
    if (deleting) return
    setDeleteOpen(false)
    setDeleteConfirm("")
    setDeleteError(null)
  }

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/profile")
  }

  async function onSave() {
    setMessage(null)
    setError(null)
    const nextErrors = validateConsumerProfileFields(profile)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      await patchProfileOnApi(profile)
      if (profile.gender.trim()) setGenderLocked(true)
      setBaseline(profile)
      setMessage("Profile saved.")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save profile.")
    } finally {
      setSaving(false)
    }
  }

  const dirty = baseline != null && !sameEditable(profile, baseline)
  const canSave = dirty && !saving
  const initial = profile.name.trim().charAt(0).toUpperCase() || "G"
  const avatarPastel = pastelForName(baseline?.name.trim() || "Guest")
  const genderOptions: string[] = [...CONSUMER_GENDER_OPTIONS]
  if (profile.gender.trim() && !genderOptions.includes(profile.gender)) genderOptions.push(profile.gender)

  return (
    <View style={styles.page}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />
            <View style={styles.headerRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={6}
                onPress={goBack}
                style={({ pressed }) => [styles.back, pressed && ui.pressed]}
              >
                <Icon name="chevron-back" size={20} color={sp.text} />
              </Pressable>
              <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
                Edit profile
              </Text>
            </View>
            <View
              style={styles.avatar}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <GradientFill colors={avatarPastel.gradient} angle={150} />
              <Text style={[styles.avatarInitial, { color: avatarPastel.ink }]}>{initial}</Text>
            </View>
            <Text style={styles.intro}>
              Saved to your Glammzo account. Your name shows as Welcome on Home.
            </Text>
          </View>

          <View style={styles.body}>
            <Section title="Personal">
              <Field
                label="Display name"
                value={profile.name}
                onChangeText={(value) => update("name", value)}
                placeholder="e.g. Priya Sharma"
                error={fieldErrors.name}
              />

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Gender</Text>
                  {genderLocked ? <Icon name="lock-closed-outline" size={13} color={LOCKED} /> : null}
                </View>
                <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Gender">
                  {genderOptions.map((option) => {
                    const active = profile.gender === option
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active, disabled: genderLocked }}
                        disabled={genderLocked}
                        onPress={() => update("gender", option as ConsumerGender)}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          fieldErrors.gender && !active && styles.chipError,
                          genderLocked && !active && styles.chipLocked,
                          pressed && ui.pressed,
                        ]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {genderLabel(option)}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
                {fieldErrors.gender ? (
                  <Text style={styles.errorText}>{fieldErrors.gender}</Text>
                ) : genderLocked ? (
                  <Text style={styles.lockedText}>Can’t be changed after it’s saved.</Text>
                ) : null}
              </View>

              <DateOfBirthField
                value={profile.dateOfBirth}
                onChange={(value) => update("dateOfBirth", value)}
                error={fieldErrors.dateOfBirth}
                labelStyle={styles.label}
                fieldStyle={styles.dobField}
                fieldErrorStyle={styles.inputError}
                valueStyle={styles.dobValue}
                errorTextStyle={styles.errorText}
              />
            </Section>

            <Section title="Contact">
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Mobile number</Text>
                  <Icon name="lock-closed-outline" size={13} color={LOCKED} />
                </View>
                <View style={[styles.input, styles.inputLocked]}>
                  <Text style={styles.lockedValue} numberOfLines={1}>
                    {profile.phone || "Verified at login"}
                  </Text>
                </View>
                <Text style={styles.lockedText}>
                  Can’t be changed. Verified at sign in and used for bookings.
                </Text>
              </View>

              <Field
                label="Email"
                value={profile.email}
                onChangeText={(value) => update("email", value)}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="you@email.com"
                error={fieldErrors.email}
              />

              <Field
                label="Address"
                value={profile.address}
                onChangeText={(value) => update("address", value)}
                placeholder="e.g. 12, MG Road, Indiranagar, Bengaluru"
                multiline
                inputStyle={styles.address}
                error={fieldErrors.address}
                onFocus={() => {
                  addressFocusedRef.current = true
                  scrollAddressIntoView()
                }}
                onBlur={() => {
                  addressFocusedRef.current = false
                }}
              />
            </Section>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete account"
              hitSlop={8}
              style={({ pressed }) => [styles.deleteLink, pressed && ui.pressed]}
              onPress={() => {
                setDeleteError(null)
                setDeleteConfirm("")
                setDeleteOpen(true)
              }}
            >
              <Text style={styles.deleteText}>Delete account</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {error ? (
            <Text style={[styles.errorText, styles.barNote]} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : message ? (
            <Text style={[styles.successText, styles.barNote]} accessibilityLiveRegion="polite">
              {message}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save changes"
            accessibilityState={{ disabled: !canSave, busy: saving }}
            disabled={!canSave}
            onPress={() => void onSave()}
            style={({ pressed }) => [
              styles.cta,
              !canSave && styles.ctaDisabled,
              pressed && canSave && ui.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.ctaText}>Save changes</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text variant="heading">Delete your account?</Text>
            <Text muted style={styles.gap}>
              This cannot be undone. Type {CONFIRM_WORD} to confirm.
            </Text>
            <Input
              label="Confirmation"
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder={CONFIRM_WORD}
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ marginTop: spacing.lg }}
            />
            {deleteError ? (
              <Text variant="caption" color={colors.destructive} style={styles.gap}>
                {deleteError}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="secondary"
                style={styles.modalBtn}
                disabled={deleting}
                onPress={closeDeleteModal}
              />
              <Button
                label="Delete account"
                loading={deleting}
                disabled={deleteConfirm.trim().toUpperCase() !== CONFIRM_WORD}
                style={{ ...styles.modalBtn, ...styles.deleteConfirmBtn }}
                onPress={async () => {
                  if (deleteConfirm.trim().toUpperCase() !== CONFIRM_WORD) return
                  setDeleting(true)
                  setDeleteError(null)
                  try {
                    await deleteAccountOnApi()
                    await clearLocalSession()
                    setDeleteOpen(false)
                    router.replace("/login")
                  } catch (err) {
                    setDeleteError(
                      err instanceof ApiError
                        ? err.message
                        : "Could not delete account.",
                    )
                  } finally {
                    setDeleting(false)
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[ui.sectionLabel, styles.sectionLabel]}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  )
}

function Field({
  label,
  error,
  inputStyle,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { label: string; error?: string | null; inputStyle?: TextInputProps["style"] }) {
  const [focused, setFocused] = useState(false)
  const showError = Boolean(error?.trim())
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={showError ? error ?? undefined : undefined}
        placeholderTextColor={LOCKED}
        style={[
          styles.input,
          styles.inputText,
          focused && styles.inputFocused,
          showError && styles.inputError,
          inputStyle,
        ]}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        {...rest}
      />
      {showError ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  header: { paddingHorizontal: 16, paddingBottom: 20, alignItems: "center" },
  headerRow: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, color: sp.text },
  avatar: {
    marginTop: 18,
    width: 72,
    height: 72,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontFamily: fontFamily.bold, fontSize: 30, lineHeight: 36 },
  intro: {
    marginTop: 12,
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: sp.secondary,
    maxWidth: 300,
  },
  body: { paddingHorizontal: 16 },
  section: { marginTop: 16 },
  sectionLabel: { marginBottom: 10, paddingHorizontal: 4 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 16,
  },
  field: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: sp.secondary },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: FIELD_BG,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  inputText: { fontFamily: fontFamily.regular, fontSize: 16, color: sp.text },
  inputFocused: { borderColor: sp.text },
  inputError: { borderColor: ERROR },
  inputLocked: { backgroundColor: "#f5f5f5" },
  lockedValue: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 21, color: LOCKED },
  lockedText: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: LOCKED },
  errorText: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: ERROR },
  successText: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: SUCCESS },
  address: { minHeight: 96, textAlignVertical: "top", paddingTop: 12, paddingBottom: 12 },
  dobField: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: FIELD_BG,
    paddingHorizontal: 14,
  },
  dobValue: { fontFamily: fontFamily.regular, fontSize: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: sp.text, borderColor: sp.text },
  chipError: { borderColor: ERROR },
  chipLocked: { opacity: 0.5 },
  chipText: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18, color: sp.text },
  chipTextActive: { color: "#ffffff" },
  deleteLink: { marginTop: 28, alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12 },
  deleteText: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 18, color: ERROR },
  bar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: sp.border,
  },
  barNote: { textAlign: "center", marginBottom: 8 },
  cta: {
    height: 52,
    borderRadius: 999,
    backgroundColor: sp.text,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { backgroundColor: DISABLED },
  ctaText: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 21, color: "#ffffff" },
  gap: { marginTop: spacing.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  modalActions: {
    marginTop: spacing.xl,
    flexDirection: "row",
    gap: spacing.md,
  },
  modalBtn: { flex: 1 },
  deleteConfirmBtn: { backgroundColor: colors.destructive },
})
