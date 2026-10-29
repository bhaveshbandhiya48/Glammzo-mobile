import { Image } from "expo-image"
import { Pressable, StyleSheet, View } from "react-native"

import { ArtistLevelBadge } from "@/components/artists/ArtistLevelBadge"
import { ArtistVerifiedBadge } from "@/components/artists/ArtistVerifiedBadge"
import { Text } from "@/components/ui/Text"
import {
  artistLevelLabel,
  parseArtistLevel,
  showArtistLevelToCustomers,
} from "@/lib/artist-level"
import type { ArtistCardData } from "@/lib/artists-api"
import { formatRupees } from "@/lib/service-pricing"
import { colors, radii, shadows, spacing } from "@/theme/tokens"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

/** "Home & studio", "Home visits" or "Studio". */
function visitLine(artist: ArtistCardData) {
  if (artist.offersHomeVisits && artist.hasStudio) return "Home & studio"
  if (artist.offersHomeVisits) return artist.coversYourArea ? "Comes to you" : "Home visits"
  if (artist.hasStudio) return "Studio"
  return null
}

type Props = {
  artist: ArtistCardData
  categoryLabel: (id: string) => string
  onPress: () => void
  /** Shorter photo for home / horizontal sliders. */
  compact?: boolean
}

/** Photo-led artist card, matching the salon card: cover photo, avatar on it, quiet rating and price. */
export function ArtistCard({ artist, categoryLabel, onPress, compact = false }: Props) {
  const distance =
    artist.distanceKm != null
      ? artist.distanceKm < 10
        ? `${artist.distanceKm.toFixed(1)} km`
        : `${Math.round(artist.distanceKm)} km`
      : null
  const placeLine = [artist.area?.trim() || null, distance].filter(Boolean).join(" · ")
  const cover = artist.portfolio.find(Boolean) ?? artist.profilePhotoUrl
  const showAvatar = Boolean(artist.profilePhotoUrl) && cover !== artist.profilePhotoUrl
  const showVerified = artist.isVerified !== false
  const level = parseArtistLevel(artist.level)
  const levelLabel = artistLevelLabel(level, artist.levelLabel)
  const hasRating = (artist.reviewCount ?? 0) > 0 && artist.averageRating != null
  const visit = visitLine(artist)
  const speciality = artist.primaryCategory ? categoryLabel(artist.primaryCategory) : null

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        artist.displayName,
        showVerified ? "verified" : null,
        showArtistLevelToCustomers(level) ? levelLabel : null,
        speciality,
        placeLine || null,
        hasRating ? `${artist.averageRating!.toFixed(1)} stars, ${artist.reviewCount} reviews` : "new",
        visit,
        artist.startingPrice != null ? `from ${formatRupees(artist.startingPrice)}` : null,
        artist.offerBadge ? `offer ${artist.offerBadge}` : null,
      ]
        .filter(Boolean)
        .join(", ")}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.photo, compact && styles.photoCompact]}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.photoImage} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.photoImage, styles.photoFallback]}>
            <Text variant="title" color={colors.textMuted}>
              {initials(artist.displayName)}
            </Text>
          </View>
        )}
        {artist.offerBadge ? (
          <View style={styles.offer} pointerEvents="none">
            <Text variant="caption" style={styles.offerText}>
              {artist.offerBadge}
            </Text>
          </View>
        ) : null}
        {showAvatar ? (
          <View style={styles.avatarRing}>
            <Image source={{ uri: artist.profilePhotoUrl! }} style={styles.avatar} contentFit="cover" />
            {showArtistLevelToCustomers(level) ? (
              <View style={styles.level}>
                <ArtistLevelBadge level={level} size={16} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {artist.displayName}
          </Text>
          {showVerified ? <ArtistVerifiedBadge size={15} /> : null}
        </View>
        {placeLine || speciality ? (
          <Text variant="caption" muted numberOfLines={1}>
            {[speciality, placeLine].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        <Text variant="caption" numberOfLines={1} style={styles.meta}>
          {hasRating ? `★ ${artist.averageRating!.toFixed(1)}` : "New"}
          {visit ? (
            <Text variant="caption" muted>
              {`  ·  ${visit}`}
            </Text>
          ) : null}
        </Text>
        {artist.startingPrice != null ? (
          <Text variant="bodyStrong" style={styles.price}>
            from {formatRupees(artist.startingPrice)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const AVATAR = 40

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    ...shadows.card,
  },
  pressed: {
    opacity: 0.94,
  },
  photo: {
    height: 180,
    backgroundColor: colors.muted,
  },
  photoCompact: {
    height: 150,
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  offer: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  offerText: {
    fontFamily: "Geist_600SemiBold",
    color: colors.text,
  },
  avatarRing: {
    position: "absolute",
    left: spacing.md,
    bottom: -AVATAR / 2,
    width: AVATAR + 4,
    height: AVATAR + 4,
    borderRadius: (AVATAR + 4) / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.muted,
  },
  level: {
    position: "absolute",
    right: -3,
    bottom: -3,
    borderRadius: 99,
    backgroundColor: colors.surface,
    padding: 1,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    fontSize: 16,
    flexShrink: 1,
  },
  meta: {
    marginTop: 4,
  },
  price: {
    marginTop: 4,
  },
})
