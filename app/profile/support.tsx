import { useCallback, useState } from "react"
import { Linking, StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
import { Screen } from "@/components/ui/Screen"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { loadProfilePreferApi } from "@/lib/profile-api"
import { getAccessToken } from "@/lib/session"
import {
  submitSupportTicket,
  supportFieldErrorsFromApi,
  type SupportTicketFieldErrors,
} from "@/lib/support-api"
import { isValidEmail } from "@/lib/user"
import { colors, radii, spacing } from "@/theme/tokens"

const SUPPORT_EMAIL = "support@glammzo.com"
const SUPPORT_HOURS = "Monday to Saturday, 9:00 AM – 7:00 PM (IST)"

type FormState = {
  name: string
  email: string
  phone: string
  bookingReference: string
  salonName: string
  message: string
}

const emptyForm: FormState = {
  name: "",
  email: "",
  phone: "",
  bookingReference: "",
  salonName: "",
  message: "",
}

function validateForm(form: FormState): SupportTicketFieldErrors {
  const errors: SupportTicketFieldErrors = {}
  if (form.name.trim().length < 2) errors.name = "Please enter your name."
  if (!isValidEmail(form.email)) errors.email = "Enter a valid email."
  if (form.bookingReference.trim().length < 4) {
    errors.bookingReference = "Enter your booking ID from the confirmation."
  }
  if (form.message.trim().length < 10) {
    errors.message = "Please describe the issue (at least 10 characters)."
  }
  const digits = form.phone.replace(/\D/g, "")
  if (form.phone.trim() && digits.length < 10) {
    errors.phone = "Enter a valid 10-digit mobile number."
  }
  return errors
}

export default function HelpSupportScreen() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<SupportTicketFieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        const token = await getAccessToken()
        if (!token) {
          router.replace({
            pathname: "/login",
            params: { next: "/profile/support" },
          })
          return
        }
        const profile = await loadProfilePreferApi()
        if (!active) return
        setForm((current) => ({
          ...current,
          name: current.name || profile.name,
          email: current.email || profile.email,
          phone: current.phone || profile.phone,
        }))
      })()
      return () => {
        active = false
      }
    }, [router]),
  )

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
    setFieldErrors((prev) => {
      if (!prev[key as keyof SupportTicketFieldErrors]) return prev
      const next = { ...prev }
      delete next[key as keyof SupportTicketFieldErrors]
      return next
    })
  }

  if (success) {
    return (
      <Screen scroll>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Icon name="checkmark-circle" size={28} color={colors.success} />
          </View>
          <Text variant="heading">Ticket sent</Text>
          <Text muted style={styles.successCopy}>
            {success}
          </Text>
          <Button
            label="Done"
            onPress={() => {
              setSuccess(null)
              setForm((current) => ({
                ...emptyForm,
                name: current.name,
                email: current.email,
                phone: current.phone,
              }))
              router.back()
            }}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen scroll keyboardAvoiding>
      <Text variant="title">Help & support</Text>
      <Text muted style={styles.gap}>
        Include your booking ID from the confirmation so we can assist faster. Our
        team will reply by email.
      </Text>
      <Text variant="caption" muted style={styles.hours}>
        {SUPPORT_HOURS}
      </Text>

      <View style={styles.form}>
        <Input
          label="Your name"
          value={form.name}
          onChangeText={(value) => update("name", value)}
          autoComplete="name"
          placeholder="Full name"
          error={fieldErrors.name}
        />
        <Input
          label="Email"
          value={form.email}
          onChangeText={(value) => update("email", value)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="you@example.com"
          error={fieldErrors.email}
        />
        <Input
          label="Mobile (optional)"
          value={form.phone}
          onChangeText={(value) => update("phone", value)}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="10-digit mobile"
          error={fieldErrors.phone}
        />
        <Input
          label="Booking ID"
          value={form.bookingReference}
          onChangeText={(value) => update("bookingReference", value)}
          autoCapitalize="characters"
          placeholder="From your confirmation"
          hint="Shown on the booking, like the first 8 characters of the ID."
          error={fieldErrors.bookingReference}
        />
        <Input
          label="Salon name (optional)"
          value={form.salonName}
          onChangeText={(value) => update("salonName", value)}
          placeholder="Where you booked"
          error={fieldErrors.salonName}
        />
        <Input
          label="How can we help?"
          value={form.message}
          onChangeText={(value) => update("message", value)}
          placeholder="Describe the issue, and include appointment date/time if relevant."
          multiline
          textAlignVertical="top"
          style={styles.message}
          error={fieldErrors.message}
        />

        {error ? (
          <Text variant="caption" color={colors.destructive}>
            {error}
          </Text>
        ) : null}

        <Button
          label="Submit ticket"
          loading={submitting}
          onPress={async () => {
            const nextErrors = validateForm(form)
            if (Object.keys(nextErrors).length > 0) {
              setFieldErrors(nextErrors)
              setError("Please check the form.")
              return
            }
            setSubmitting(true)
            setError(null)
            try {
              const result = await submitSupportTicket(form)
              setSuccess(result.message)
              setFieldErrors({})
            } catch (err) {
              setFieldErrors(supportFieldErrorsFromApi(err))
              setError(
                err instanceof ApiError
                  ? err.message
                  : "Could not submit your ticket. Please try again.",
              )
            } finally {
              setSubmitting(false)
            }
          }}
        />

        <Button
          label={`Email ${SUPPORT_EMAIL}`}
          variant="secondary"
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  gap: {
    marginTop: spacing.sm,
  },
  hours: {
    marginTop: spacing.md,
  },
  form: {
    marginTop: spacing.xxxl,
    gap: spacing.lg,
  },
  message: {
    minHeight: 140,
    paddingTop: spacing.md,
  },
  successCard: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  successCopy: {
    marginBottom: spacing.sm,
  },
})
