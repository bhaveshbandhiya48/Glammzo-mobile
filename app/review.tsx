import { useLocalSearchParams, useRouter } from "expo-router"
import { useRef, useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ReviewPhotoPicker } from "@/components/reviews/ReviewPhotoPicker"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
import { Screen } from "@/components/ui/Screen"
import { SuccessScreen } from "@/components/ui/SuccessScreen"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { submitArtistReview, submitSalonReview } from "@/lib/reviews-api"
import { colors, radii, spacing } from "@/theme/tokens"

function firstParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

const STAND_OUT = [
  "Skill & technique",
  "Professionalism",
  "Communication",
  "Hospitality",
  "Overall experience",
]

export default function ReviewScreen() {
  const router = useRouter()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const params = useLocalSearchParams<{
    appointmentId?: string | string[]
    salonName?: string | string[]
    staffName?: string | string[]
    kind?: string | string[]
    artistPublicToken?: string | string[]
  }>()
  const appointmentId = firstParam(params.appointmentId)
  const salonName = firstParam(params.salonName)
  const stylist = firstParam(params.staffName)
  const kind = firstParam(params.kind)
  const artistPublicToken = firstParam(params.artistPublicToken)
  const isArtist = kind === "artist" || Boolean(artistPublicToken)

  const [rating, setRating] = useState(5)
  const [chip, setChip] = useState(STAND_OUT[0])
  const [comment, setComment] = useState("")
  const [includeStaff, setIncludeStaff] = useState(Boolean(stylist) && !isArtist)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photosBusy, setPhotosBusy] = useState(false)

  const title = salonName || (isArtist ? "Artist" : "Salon")
  const reviewTargetId = isArtist ? artistPublicToken : appointmentId
  const canSubmit =
    Boolean(reviewTargetId) && comment.trim().length >= 3 && rating >= 1 && !photosBusy

  async function handleSubmit() {
    if (!reviewTargetId || !canSubmit) return
    setLoading(true)
    setError(null)
    try {
      if (isArtist) {
        await submitArtistReview({
          publicToken: reviewTargetId,
          rating,
          reviewType: chip,
          comment: comment.trim(),
          photoUrls,
        })
      } else {
        await submitSalonReview({
          appointmentId: reviewTargetId,
          rating,
          reviewType: chip,
          comment: comment.trim(),
          includeStaffReview: Boolean(stylist && includeStaff),
          photoUrls,
        })
      }
      setDone(true)
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Could not submit review.",
      )
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
      <SuccessScreen
        title="Thanks for your review"
        message="Your feedback helps other guests choose with confidence."
        primary={{ label: "Back to bookings", onPress: () => router.replace("/(tabs)/bookings") }}
        secondary={{ label: "Go to Home", onPress: () => router.replace("/(tabs)/explore") }}
      >
        <View style={styles.doneHead}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>
          <View style={styles.doneStars} accessible accessibilityLabel={`${rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Icon
                key={value}
                name={value <= rating ? "star" : "star-outline"}
                size={14}
                color={colors.text}
              />
            ))}
          </View>
        </View>
        <Text variant="body" muted numberOfLines={3}>
          {`“${comment.trim()}”`}
        </Text>
      </SuccessScreen>
    )
  }

  if (!reviewTargetId) {
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
            {isArtist ? `How was your experience with ${title}?` : title}
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
                    color={filled ? colors.primary : colors.textSubtle}
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
                accessibilityRole="button"
                key={item}
                style={[styles.chip, chip === item && styles.chipActive]}
                onPress={() => setChip(item)}
              >
                <Text
                  variant="caption"
                  color={chip === item ? colors.primary : colors.text}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          {!isArtist && stylist ? (
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

          <View style={styles.section}>
            <ReviewPhotoPicker urls={photoUrls} onChange={setPhotoUrls} onBusyChange={setPhotosBusy} />
          </View>

          {error ? (
            <Text variant="caption" color={colors.destructive} style={styles.gap}>
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
  doneHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  doneStars: {
    flexDirection: "row",
    gap: 2,
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
    borderColor: colors.primary,
    backgroundColor: "#F1F1F1",
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
    borderColor: colors.primary,
    backgroundColor: "#F1F1F1",
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
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  staffCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
})
