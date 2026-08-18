import { useLocalSearchParams, useRouter } from "expo-router"
import { useRef, useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
import { Screen } from "@/components/ui/Screen"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { submitSalonReview } from "@/lib/reviews-api"
import { colors, radii, spacing } from "@/theme/tokens"

const STAND_OUT = [
  "Skill & technique",
  "Professionalism",
  "Communication",
  "Hospitality",
  "Overall experience",
]

export default function ReviewScreen() {
  const router = useRouter()
  const scrollRef = useRef<ScrollView>(null)
  const { appointmentId, salonName, staffName } = useLocalSearchParams<{
    appointmentId?: string
    salonName?: string
    staffName?: string
  }>()
  const stylist =
    typeof staffName === "string" && staffName.trim().length > 0
      ? staffName.trim()
      : null

  const [rating, setRating] = useState(5)
  const [chip, setChip] = useState(STAND_OUT[0])
  const [comment, setComment] = useState("")
  const [includeStaff, setIncludeStaff] = useState(Boolean(stylist))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const title = salonName || "Salon"
  const canSubmit =
    Boolean(appointmentId) && comment.trim().length >= 3 && rating >= 1

  async function handleSubmit() {
    if (!appointmentId || !canSubmit) return
    setLoading(true)
    setError(null)
    try {
      await submitSalonReview({
        appointmentId,
        rating,
        reviewType: chip,
        comment: comment.trim(),
        includeStaffReview: Boolean(stylist && includeStaff),
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit review.")
    } finally {
      setLoading(false)
    }
  }

  function scrollCommentIntoView() {
    // Let the keyboard animate in, then bring the comment + CTA into view.
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true })
      }, Platform.OS === "ios" ? 80 : 120)
    })
  }

  if (done) {
    return (
      <Screen>
        <Text variant="title">Thanks for the review</Text>
        <Text muted style={styles.gap}>
          Your feedback helps other guests choose with confidence.
        </Text>
        <Button
          label="Back to bookings"
          style={{ marginTop: spacing.xl }}
          onPress={() => router.replace("/(tabs)/bookings")}
        />
      </Screen>
    )
  }

  if (!appointmentId) {
    return (
      <Screen>
        <Text variant="title">Review unavailable</Text>
        <Text muted style={styles.gap}>
          Open this screen from a completed booking.
        </Text>
        <Button
          label="Back to bookings"
          style={{ marginTop: spacing.xl }}
          onPress={() => router.replace("/(tabs)/bookings")}
        />
      </Screen>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <Text variant="title">Leave a review</Text>
          <Text muted style={styles.gap}>
            {title}
          </Text>

          <Text variant="label" muted style={styles.section}>
            Rating
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => {
              const filled = value <= rating
              return (
                <Pressable
                  key={value}
                  onPress={() => setRating(value)}
                  hitSlop={10}
                  style={styles.starBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`${value} star${value === 1 ? "" : "s"}`}
                  accessibilityState={{ selected: filled }}
                >
                  <Icon
                    name={filled ? "star" : "star-outline"}
                    size={32}
                    color={filled ? colors.coral : colors.textSubtle}
                  />
                </Pressable>
              )
            })}
          </View>

          <Text variant="label" muted style={styles.section}>
            What stood out
          </Text>
          <View style={styles.chips}>
            {STAND_OUT.map((item) => (
              <Pressable
                key={item}
                style={[styles.chip, chip === item && styles.chipActive]}
                onPress={() => setChip(item)}
              >
                <Text
                  variant="caption"
                  color={chip === item ? colors.coral : colors.text}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          {stylist ? (
            <Pressable
              style={[styles.staffCard, includeStaff && styles.staffCardActive]}
              onPress={() => setIncludeStaff((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: includeStaff }}
            >
              <View
                style={[styles.checkbox, includeStaff && styles.checkboxChecked]}
              >
                {includeStaff ? (
                  <Icon name="checkmark" size={14} color={colors.primaryFg} />
                ) : null}
              </View>
              <View style={styles.staffCopy}>
                <Text variant="bodyStrong">Add review for {stylist}</Text>
                <Text variant="caption" muted>
                  Optional — your feedback will appear on this team member’s
                  profile at the salon.
                </Text>
              </View>
            </Pressable>
          ) : null}

          <View style={styles.section}>
            <Input
              label="Comment"
              value={comment}
              onChangeText={setComment}
              onFocus={scrollCommentIntoView}
              placeholder="Share a few details (min 3 characters)"
              multiline
              style={{
                minHeight: 96,
                textAlignVertical: "top",
                paddingTop: spacing.md,
              }}
            />
          </View>

          {error ? (
            <Text variant="caption" color={colors.coral} style={styles.gap}>
              {error}
            </Text>
          ) : null}

          <Button
            label="Submit review"
            loading={loading}
            disabled={!canSubmit}
            style={{ marginTop: spacing.xl }}
            onPress={handleSubmit}
          />
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
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  gap: {
    marginTop: spacing.sm,
  },
  section: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  stars: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  starBtn: {
    padding: 2,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.coral,
    backgroundColor: "#FFF7F5",
  },
  staffCard: {
    marginTop: spacing.xxl,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  staffCardActive: {
    borderColor: colors.coral,
    backgroundColor: "#FFF7F5",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
  staffCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
})
