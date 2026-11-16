import { Stack, useLocalSearchParams, useRouter } from "expo-router"
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
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  BookingCard,
  BookingHeader,
  BookingSectionLabel,
  CheckRow,
  FlowSuccess,
  PlaceRow,
  bk,
  bookingStyles,
} from "@/components/book/BookingUi"
import { SEE_ALL_EMPTY_COLORS, SeeAllEmpty } from "@/components/list/SeeAllParts"
import { Chip, Field, PrimaryPill } from "@/components/profile/ProfileScreenParts"
import { ReviewPhotoPicker } from "@/components/reviews/ReviewPhotoPicker"
import { pastels } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { MAX_REVIEW_PHOTOS, submitArtistReview, submitSalonReview } from "@/lib/reviews-api"
import { fontFamily } from "@/theme/tokens"

const RATING_LABELS = ["Poor", "Fair", "Good", "Great", "Loved it"]

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
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const params = useLocalSearchParams<{
    appointmentId?: string | string[]
    salonName?: string | string[]
    staffName?: string | string[]
    kind?: string | string[]
    artistPublicToken?: string | string[]
    imageUrl?: string | string[]
  }>()
  const appointmentId = firstParam(params.appointmentId)
  const salonName = firstParam(params.salonName)
  const stylist = firstParam(params.staffName)
  const kind = firstParam(params.kind)
  const artistPublicToken = firstParam(params.artistPublicToken)
  const placePhoto = firstParam(params.imageUrl)
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

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/bookings")
  }

  if (done) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <FlowSuccess
          icon="star"
          pastel={pastels.gold}
          title="Thanks for your review"
          message="Your feedback helps other guests choose with confidence."
          primary={{ label: "Back to bookings", onPress: () => router.replace("/(tabs)/bookings") }}
          secondary={{ label: "Go to Home", onPress: () => router.replace("/(tabs)/explore") }}
        >
          <View style={styles.doneHead}>
            <Text style={styles.doneName} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.doneStars} accessible accessibilityLabel={`${rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Icon key={value} name={value <= rating ? "star" : "star-outline"} size={14} color={bk.star} />
              ))}
            </View>
          </View>
          <Text style={styles.doneQuote} numberOfLines={3}>
            {`“${comment.trim()}”`}
          </Text>
        </FlowSuccess>
      </>
    )
  }

  if (!reviewTargetId) {
    return (
      <View style={bookingStyles.page}>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingHeader title="Leave a review" onBack={goBack} />
        <SeeAllEmpty
          icon="star-outline"
          colors={SEE_ALL_EMPTY_COLORS.salons}
          title="Review unavailable"
          body="Open this screen from a completed booking."
          actionLabel="Back to bookings"
          onAction={() => router.replace("/(tabs)/bookings")}
        />
      </View>
    )
  }

  const commentTooShort = comment.trim().length > 0 && comment.trim().length < 3

  return (
    <View style={bookingStyles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={bookingStyles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BookingHeader title="Leave a review" subtitle={title} onBack={goBack} />
        <ScrollView
          ref={scrollRef}
          style={bookingStyles.page}
          contentContainerStyle={[bookingStyles.body, styles.scroll]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <BookingCard style={styles.placeCard}>
            <PlaceRow
              imageUrl={placePhoto}
              name={title}
              caption={isArtist ? "Solo artist" : stylist ? `With ${stylist}` : "Salon visit"}
            />
          </BookingCard>

          <BookingSectionLabel>Your rating</BookingSectionLabel>
          <BookingCard style={styles.ratingCard}>
            <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Rating">
              {[1, 2, 3, 4, 5].map((value) => {
                const filled = value <= rating
                return (
                  <Pressable
                    key={value}
                    onPress={() => setRating(value)}
                    hitSlop={6}
                    style={({ pressed }) => [styles.starBtn, pressed && styles.pressed]}
                    accessibilityRole="radio"
                    accessibilityLabel={`${value} star${value === 1 ? "" : "s"}, ${RATING_LABELS[value - 1]}`}
                    accessibilityState={{ selected: value === rating, checked: value === rating }}
                  >
                    <Icon name={filled ? "star" : "star-outline"} size={40} color={filled ? bk.star : "#c9c9c9"} />
                  </Pressable>
                )
              })}
            </View>
            <Text style={styles.ratingLabel} accessibilityLiveRegion="polite">
              {RATING_LABELS[rating - 1]}
            </Text>
          </BookingCard>

          <BookingSectionLabel>What stood out</BookingSectionLabel>
          <View style={styles.chips}>
            {STAND_OUT.map((item) => (
              <Chip key={item} label={item} active={chip === item} onPress={() => setChip(item)} />
            ))}
          </View>

          {!isArtist && stylist ? (
            <BookingCard style={styles.staffCard}>
              <CheckRow
                checked={includeStaff}
                onPress={() => setIncludeStaff((value) => !value)}
                title={`Add review for ${stylist}`}
                caption="Optional — your feedback will appear on this team member’s profile at the salon."
              />
            </BookingCard>
          ) : null}

          <BookingSectionLabel>Your review</BookingSectionLabel>
          <Field
            value={comment}
            onChangeText={setComment}
            onFocus={scrollCommentIntoView}
            placeholder="Share a few details (min 3 characters)"
            accessibilityLabel="Comment"
            multiline
            hint={commentTooShort ? "A few more characters, please." : undefined}
          />

          <BookingSectionLabel>{`Photos (optional, up to ${MAX_REVIEW_PHOTOS})`}</BookingSectionLabel>
          <ReviewPhotoPicker urls={photoUrls} onChange={setPhotoUrls} onBusyChange={setPhotosBusy} />
        </ScrollView>

        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {error ? (
            <Text style={styles.barError} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <PrimaryPill
            label={photosBusy ? "Uploading photos…" : "Submit review"}
            loading={loading}
            disabled={!canSubmit}
            onPress={() => void handleSubmit()}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  pressed: { opacity: 0.7 },
  placeCard: { marginTop: 8 },
  ratingCard: { alignItems: "center", paddingVertical: 20 },
  stars: { flexDirection: "row", alignItems: "center", gap: 6 },
  starBtn: { padding: 4 },
  ratingLabel: {
    marginTop: 10,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: bk.text,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  staffCard: { marginTop: 16, paddingVertical: 4 },
  bar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: bk.hairline,
    gap: 8,
  },
  barError: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: bk.red,
    textAlign: "center",
  },
  doneHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  doneName: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: bk.text },
  doneStars: { flexDirection: "row", gap: 2 },
  doneQuote: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: bk.secondary },
})
