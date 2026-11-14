import { StyleSheet, View } from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import { pastelForName } from "@/components/home/PhotoFallback"
import { ReviewPhotos } from "@/components/reviews/ReviewPhotos"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { SalonReview } from "@/data/types"
import { fontFamily } from "@/theme/tokens"

import { initialsOf, sp } from "./theme"

export function ReviewSummary({ rating, reviews }: { rating: number; reviews: number }) {
  return (
    <View
      style={styles.summary}
      accessible
      accessibilityLabel={`${rating.toFixed(1)} out of 5 from ${reviews} review${reviews === 1 ? "" : "s"}`}
    >
      <Text style={styles.bigRating}>{rating.toFixed(1)}</Text>
      <View style={{ gap: 4 }}>
        <View style={styles.stars}>
          {Array.from({ length: 5 }, (_, i) => {
            const name = rating >= i + 0.75 ? "star" : rating >= i + 0.25 ? "star-half" : "star-outline"
            return <Icon key={i} name={name} size={16} color={sp.star} />
          })}
        </View>
        <Text style={styles.meta}>
          {reviews} review{reviews === 1 ? "" : "s"}
        </Text>
      </View>
    </View>
  )
}

export function SalonReviewCard({ review }: { review: SalonReview }) {
  const pastel = pastelForName(review.authorName)
  const subline = [review.date, review.serviceName].filter((part) => part?.trim()).join(" · ")
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
        <View style={styles.ratingPill}>
          <Text style={styles.ratingText}>{review.rating.toFixed(1)}★</Text>
        </View>
      </View>
      {review.comment?.trim() ? <Text style={styles.comment}>{review.comment}</Text> : null}
      {review.verified ? (
        <View style={styles.verified}>
          <Text style={styles.verifiedText}>✓ Verified visit</Text>
        </View>
      ) : null}
      <ReviewPhotos urls={review.photoUrls} title={`${review.authorName}'s photos`} />
      {review.ownerReply?.trim() ? (
        <View style={styles.reply}>
          <Text style={styles.replyText}>
            <Text style={styles.replyLabel}>Reply from salon: </Text>
            {review.ownerReply.trim()}
          </Text>
          {review.ownerReplyDate ? <Text style={[styles.meta, { marginTop: 4 }]}>{review.ownerReplyDate}</Text> : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  bigRating: {
    fontFamily: fontFamily.bold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.2,
    color: sp.text,
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: sp.secondary,
  },
  card: {
    borderWidth: 1,
    borderColor: sp.tabBorder,
    borderRadius: 18,
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
