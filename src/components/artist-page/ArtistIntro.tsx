import { Pressable, StyleSheet, View } from "react-native"

import { ArtistLevelBadge } from "@/components/artists/ArtistLevelBadge"
import { ArtistVerifiedBadge } from "@/components/artists/ArtistVerifiedBadge"
import { PhotoOrFallback } from "@/components/home/PhotoFallback"
import { PastelIcon, type Pastel } from "@/components/profile/ProfileParts"
import { sp, ui } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { ArtistLevelId } from "@/lib/artist-level"
import { fontFamily } from "@/theme/tokens"

export type QuickFact = {
  key: string
  icon: IconName
  pastel: Pastel
  value: string
  label: string
}

type Props = {
  name: string
  photoUrl: string | null
  verified: boolean
  level: ArtistLevelId
  levelName: string
  rating: number
  reviewCount: number
  specialities: string[]
  place: string
  comesToYou: boolean
  studio: boolean
  instagramHandle: string | null
  facts: QuickFact[]
  onPressRating: () => void
  onOpenInstagram: () => void
}

/** Identity block that overlaps the hero: avatar, name, level, rating, tags, quick facts. */
export function ArtistIntro({
  name,
  photoUrl,
  verified,
  level,
  levelName,
  rating,
  reviewCount,
  specialities,
  place,
  comesToYou,
  studio,
  instagramHandle,
  facts,
  onPressRating,
  onOpenInstagram,
}: Props) {
  const signature = level === "top_rated"
  const rated = reviewCount > 0

  return (
    <View style={styles.sheet}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <PhotoOrFallback uri={photoUrl} name={name} />
        </View>
        <View style={styles.identityCopy}>
          <View style={styles.nameRow}>
            <Text style={styles.name} accessibilityRole="header" numberOfLines={2}>
              {name}
            </Text>
            {verified ? <ArtistVerifiedBadge size={18} /> : null}
          </View>
          {place ? (
            <View style={styles.placeRow}>
              <Icon name="location-outline" size={14} color={sp.secondary} />
              <Text style={styles.place} numberOfLines={1}>
                {place}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.pills}>
        <View
          style={[styles.pill, signature ? styles.levelSignature : styles.greyPill]}
          accessible
          accessibilityLabel={`${levelName} level`}
        >
          <ArtistLevelBadge level={level} size={18} />
          <Text style={[styles.pillText, signature && { color: sp.peachInk }]}>{levelName}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            rated
              ? `Rated ${rating.toFixed(1)} from ${reviewCount} review${reviewCount === 1 ? "" : "s"}. See reviews`
              : "New on Glammzo. See reviews"
          }
          onPress={onPressRating}
          style={({ pressed }) => [styles.pill, styles.ratingPill, pressed && ui.pressed]}
        >
          <Text style={[styles.pillText, { color: sp.ratingInk }]}>
            {rated ? `${rating.toFixed(1)}★ · ${reviewCount} review${reviewCount === 1 ? "" : "s"}` : "New on Glammzo"}
          </Text>
        </Pressable>
      </View>

      {specialities.length > 0 ? (
        <Text style={styles.specialities} numberOfLines={2}>
          {specialities.join(" · ")}
        </Text>
      ) : null}

      {comesToYou || studio || instagramHandle ? (
        <View style={styles.tags}>
          {comesToYou ? <Tag icon="home-outline" label="Comes to you" /> : null}
          {studio ? <Tag icon="storefront-outline" label="Studio" /> : null}
          {instagramHandle ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Instagram, ${instagramHandle}`}
              onPress={onOpenInstagram}
              style={({ pressed }) => [pressed && ui.pressed]}
            >
              <Tag icon="logo-instagram" label="Instagram" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {facts.length > 0 ? (
        <View style={styles.facts}>
          {facts.map((fact) => (
            <View
              key={fact.key}
              style={styles.fact}
              accessible
              accessibilityLabel={`${fact.value} ${fact.label}`}
            >
              <PastelIcon pastel={fact.pastel} name={fact.icon} size={32} />
              <Text style={styles.factValue} numberOfLines={1}>
                {fact.value}
              </Text>
              <Text style={styles.factLabel} numberOfLines={1}>
                {fact.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function Tag({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.tag}>
      <Icon name={icon} size={14} color={sp.text} />
      <Text style={styles.tagText}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#ffffff",
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: sp.grey,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.5,
    color: sp.text,
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  place: {
    flexShrink: 1,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 19,
    color: sp.secondary,
  },
  pills: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  levelSignature: {
    backgroundColor: sp.peachBg,
    paddingLeft: 8,
  },
  greyPill: {
    backgroundColor: sp.grey,
    paddingLeft: 8,
  },
  ratingPill: {
    backgroundColor: sp.ratingBg,
  },
  pillText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: sp.text,
  },
  specialities: {
    marginTop: 12,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: sp.body,
  },
  tags: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tagText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 17,
    color: sp.text,
  },
  facts: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  fact: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
  },
  factValue: {
    marginTop: 2,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 20,
    color: sp.text,
  },
  factLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: sp.secondary,
  },
})
