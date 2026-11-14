import { StyleSheet, View } from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import { pastelForName } from "@/components/home/PhotoFallback"
import { ReviewPhotos } from "@/components/reviews/ReviewPhotos"
import { initialsOf, sp } from "@/components/salon-page/theme"
import { Text } from "@/components/ui/Text"
import type { PublicArtistReview } from "@/lib/artists-api"
import { fontFamily } from "@/theme/tokens"

function shortDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

/** Same card as the salon page reviews, for artist review data. */
export function ArtistReviewCard({ review }: { review: PublicArtistReview }) {
  const pastel = pastelForName(review.authorName)
  const rating = Number(review.rating) || 0
  const subline = [shortDate(review.createdAt), review.serviceName].filter((part) => part?.trim()).join(" · ")
  const replyDate = shortDate(review.ownerReplyAt)

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <GradientFill colors={pastel.gradient} angle={150} radius={12} />
          <Text style={[styles.initials, { color: pastel.ink }]}>{initialsOf(review.authorName)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.author} numberOfLines={1}>
            {review.authorName}
          </Text>
          {subline ? (
            <Text style={styles.meta} numberOfLines={1}>
              {subline}
            </Text>
          ) : null}
        </View>
        <View style={styles.ratingPill} accessible accessibilityLabel={`${rating.toFixed(1)} stars`}>
          <Text style={styles.ratingText}>{rating.toFixed(1)}★</Text>
        </View>
      </View>
      {review.comment?.trim() ? <Text style={styles.comment}>{review.comment}</Text> : null}
      {review.verified ? (
        <View style={styles.verified}>
          <Text style={styles.verifiedText}>✓ Verified booking</Text>
        </View>
      ) : null}
      <ReviewPhotos urls={review.photoUrls} title={`${review.authorName}'s photos`} />
      {review.ownerReply?.trim() ? (
        <View style={styles.reply}>
          <Text style={styles.replyText}>
            <Text style={styles.replyLabel}>Reply from artist: </Text>
            {review.ownerReply.trim()}
          </Text>
          {replyDate ? <Text style={[styles.meta, { marginTop: 4 }]}>{replyDate}</Text> : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: sp.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    backgroundColor: "#ffffff",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    lineHeight: 16,
  },
  author: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: sp.text,
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: sp.secondary,
  },
  ratingPill: {
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 999,
    backgroundColor: sp.ratingBg,
    justifyContent: "center",
  },
  ratingText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 15,
    color: sp.ratingInk,
  },
  comment: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.body,
  },
  verified: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: sp.grey,
  },
  verifiedText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 15,
    color: sp.label,
  },
  reply: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 12,
  },
  replyText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: sp.body,
  },
  replyLabel: {
    fontFamily: fontFamily.bold,
    color: sp.text,
  },
})
