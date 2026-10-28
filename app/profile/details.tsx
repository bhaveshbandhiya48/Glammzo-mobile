import { useCallback, useEffect, useRef, useState } from "react"
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Button } from "@/components/ui/Button"
import { DateOfBirthField } from "@/components/ui/DateOfBirthField"
import { GenderSelectField } from "@/components/ui/GenderSelectField"
import { Input } from "@/components/ui/Input"
import { Screen } from "@/components/ui/Screen"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import {
  deleteAccountOnApi,
  loadProfilePreferApi,
  patchProfileOnApi,
} from "@/lib/profile-api"
import { getAccessToken } from "@/lib/session"
import {
  clearLocalSession,
  validateConsumerProfileFields,
  type ConsumerProfile,
  type ConsumerProfileFieldErrors,
} from "@/lib/user"
import { colors, radii, spacing } from "@/theme/tokens"

const CONFIRM_WORD = "DELETE"

export default function ProfileDetailsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const addressFocusedRef = useRef(false)
  const [profile, setProfile] = useState<ConsumerProfile>({
    name: "",
    email: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
    address: "",
  })
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

  return (
    <Screen
      scroll
      scrollRef={scrollRef}
      keyboardAvoiding
      keyboardVerticalOffset={insets.top + 48}
      contentStyle={styles.scrollContent}
    >
      <Text variant="title">Profile information</Text>
      <Text muted style={styles.gap}>
        Saved to your Glammzo account. Your name shows as Welcome on Home.
      </Text>

      <View style={styles.form}>
        <Input
          label="Display name"
          value={profile.name}
          onChangeText={(value) => update("name", value)}
          placeholder="e.g. Priya Sharma"
          error={fieldErrors.name}
        />
        <Input
          label="Email"
          value={profile.email}
          onChangeText={(value) => update("email", value)}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@email.com"
          error={fieldErrors.email}
        />
        <View style={styles.field}>
          <Input
            label="Mobile number"
            value={profile.phone || "Verified at login"}
            editable={false}
            placeholder="Verified at login"
          />
          <Text variant="caption" muted>
            Your mobile number is verified at sign in and used for bookings.
          </Text>
        </View>

        <GenderSelectField
          value={profile.gender}
          locked={genderLocked}
          onChange={(value) => update("gender", value)}
          error={fieldErrors.gender}
        />

        <DateOfBirthField
          value={profile.dateOfBirth}
          onChange={(value) => update("dateOfBirth", value)}
          error={fieldErrors.dateOfBirth}
        />
        <Input
          label="Address"
          value={profile.address}
          onChangeText={(value) => update("address", value)}
          placeholder="e.g. 12, MG Road, Indiranagar, Bengaluru"
          multiline
          style={styles.address}
          error={fieldErrors.address}
          onFocus={() => {
            addressFocusedRef.current = true
            scrollAddressIntoView()
          }}
          onBlur={() => {
            addressFocusedRef.current = false
          }}
        />
      </View>

      {error ? (
        <Text variant="caption" color={colors.destructive} style={styles.gap}>
          {error}
        </Text>
      ) : null}
      {message ? (
        <Text variant="caption" color={colors.success} style={styles.gap}>
          {message}
        </Text>
      ) : null}

      <Button
        label="Save profile"
        loading={saving}
        style={{ marginTop: spacing.xl }}
        onPress={async () => {
          setMessage(null)
          setError(null)
          const nextErrors = validateConsumerProfileFields(profile)
          setFieldErrors(nextErrors)
          if (Object.keys(nextErrors).length > 0) return

          setSaving(true)
          try {
            await patchProfileOnApi(profile)
            if (profile.gender.trim()) setGenderLocked(true)
            setMessage("Profile saved.")
          } catch (err) {
            setError(
              err instanceof ApiError ? err.message : "Could not save profile.",
            )
          } finally {
            setSaving(false)
          }
        }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete account"
        hitSlop={8}
        style={styles.deleteLink}
        onPress={() => {
          setDeleteError(null)
          setDeleteConfirm("")
          setDeleteOpen(true)
        }}
      >
        <Text variant="body" color={colors.destructive}>
          Delete account
        </Text>
      </Pressable>

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
    </Screen>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 140,
  },
  gap: {
    marginTop: spacing.sm,
  },
  form: {
    marginTop: spacing.xxxl,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  address: {
    minHeight: 96,
    textAlignVertical: "top",
    paddingTop: spacing.md,
  },
  deleteLink: {
    marginTop: spacing.xxxl,
    alignSelf: "center",
    paddingVertical: spacing.sm,
  },
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
  modalBtn: {
    flex: 1,
  },
  deleteConfirmBtn: {
    backgroundColor: colors.destructive,
  },
})
