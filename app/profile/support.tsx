import { useCallback, useState } from "react"
import { Linking, Pressable, StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { PastelIcon } from "@/components/profile/ProfileParts"
import {
  Card,
  Field,
  HEADER_TINTS,
  PrimaryPill,
  ProfileSubScreen,
  SectionLabel,
} from "@/components/profile/ProfileScreenParts"
import { pastels, sp, ui } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
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
import { fontFamily } from "@/theme/tokens"

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


  async function submit() {
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
      setError(err instanceof ApiError ? err.message : "Could not submit your ticket. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <ProfileSubScreen title="Help and support" tint={HEADER_TINTS.help}>
        <Card style={styles.successCard}>
          <View style={styles.successIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon name="checkmark" size={30} color="#17633e" />
          </View>
          <Text style={styles.successTitle} accessibilityRole="header">
            Ticket sent
          </Text>
          <Text style={styles.successCopy}>{success}</Text>
          <View style={styles.successAction}>
            <PrimaryPill
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
        </Card>
      </ProfileSubScreen>
    )
  }

  return (
    <ProfileSubScreen title="Help and support" subtitle="We reply by email" tint={HEADER_TINTS.help} keyboard>
      <SectionLabel first>Contact us</SectionLabel>
      <Card style={styles.contactCard}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Email ${SUPPORT_EMAIL}`}
          accessibilityHint="Opens your email app"
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          style={({ pressed }) => [styles.contactRow, pressed && ui.pressed]}
        >
          <PastelIcon pastel={pastels.sky} name="mail-outline" />
          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>Email us</Text>
            <Text style={styles.contactValue} numberOfLines={1}>
              {SUPPORT_EMAIL}
            </Text>
          </View>
          <Icon name="open-outline" size={18} color={sp.secondary} />
        </Pressable>
        <View style={styles.contactRow} accessible accessibilityLabel={`Support hours: ${SUPPORT_HOURS}`}>
          <View style={styles.hairline} />
          <PastelIcon pastel={pastels.lavender} name="time-outline" />
          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>Support hours</Text>
            <Text style={styles.contactValue}>{SUPPORT_HOURS}</Text>
          </View>
        </View>
      </Card>

      <SectionLabel>Raise a ticket</SectionLabel>
      <Card>
        <Text style={styles.intro}>
          Include your booking ID from the confirmation so we can help faster. Our team will reply by email.
        </Text>
        <Field
          label="Your name"
          value={form.name}
          onChangeText={(value) => update("name", value)}
          autoComplete="name"
          placeholder="Full name"
          error={fieldErrors.name}
        />
        <Field
          label="Email"
          value={form.email}
          onChangeText={(value) => update("email", value)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="you@example.com"
          error={fieldErrors.email}
        />
        <Field
          label="Mobile (optional)"
          value={form.phone}
          onChangeText={(value) => update("phone", value)}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="10-digit mobile"
          error={fieldErrors.phone}
        />
        <Field
          label="Booking ID"
          value={form.bookingReference}
          onChangeText={(value) => update("bookingReference", value)}
          autoCapitalize="characters"
          placeholder="From your confirmation"
          hint="Shown on the booking, like the first 8 characters of the ID."
          error={fieldErrors.bookingReference}
        />
        <Field
          label="Salon name (optional)"
          value={form.salonName}
          onChangeText={(value) => update("salonName", value)}
          placeholder="Where you booked"
          error={fieldErrors.salonName}
        />
        <Field
          label="How can we help?"
          value={form.message}
          onChangeText={(value) => update("message", value)}
          placeholder="Describe the issue, and include appointment date/time if relevant."
          multiline
          style={styles.message}
          error={fieldErrors.message}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryPill label="Submit ticket" loading={submitting} onPress={() => void submit()} />
      </Card>
    </ProfileSubScreen>
  )
}

const styles = StyleSheet.create({
  contactCard: { padding: 0, gap: 0, overflow: "hidden" },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 12 },
  hairline: {
    position: "absolute",
    top: 0,
    left: 62,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: sp.border,
  },
  contactText: { flex: 1, minWidth: 0, gap: 1 },
  contactLabel: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 20, color: sp.text },
  contactValue: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: sp.secondary },
  intro: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: sp.secondary },
  message: { minHeight: 140 },
  error: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: "#c0392b" },
  successCard: { marginTop: 12, alignItems: "center", paddingVertical: 28, gap: 10 },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e6f5ec",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  successTitle: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, color: sp.text },
  successCopy: {
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.secondary,
  },
  successAction: { alignSelf: "stretch", marginTop: 8 },
})
