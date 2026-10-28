import { Image } from "expo-image"
import { Pressable, StyleSheet, View } from "react-native"

import { ArtistLevelBadge } from "@/components/artists/ArtistLevelBadge"
import { ArtistVerifiedBadge } from "@/components/artists/ArtistVerifiedBadge"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import {
  artistLevelLabel,
  parseArtistLevel,
} from "@/lib/artist-level"
import type { ArtistCardData } from "@/lib/artists-api"
import { colors, radii, shadows, spacing } from "@/theme/tokens"

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

type Props = {
  artist: ArtistCardData
  categoryLabel: (id: string) => string
  onPress: () => void
  /** Smaller card for home / horizontal sliders. */
  compact?: boolean
}

export function ArtistCard({ artist, categoryLabel: _categoryLabel, onPress, compact = false }: Props) {
  const where = artist.area?.trim() || null
  const distanceLabel =
    artist.distanceKm != null
      ? artist.distanceKm < 10
        ? `${artist.distanceKm.toFixed(1)} km`
        : `${Math.round(artist.distanceKm)} km`
      : null
  const placeLine = [where, distanceLabel].filter(Boolean).join(" · ")
  const avatarSize = compact ? 52 : 56
  const showVerified = artist.isVerified !== false
  const showHome = Boolean(artist.offersHomeVisits)
  const showStudio = Boolean(artist.hasStudio)
  const level = parseArtistLevel(artist.level)
  const levelLabel = artistLevelLabel(level, artist.levelLabel)

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${artist.displayName}${showVerified ? ", verified" : ""}, ${levelLabel}${placeLine ? `, ${placeLine}` : ""}${(artist.reviewCount ?? 0) > 0 && artist.averageRating != null ? `, ${artist.averageRating.toFixed(1)} stars` : ""}`}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          {artist.profilePhotoUrl ? (
            <Image
              source={{ uri: artist.profilePhotoUrl }}
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: colors.muted,
              }}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                },
              ]}
            >
              <Text variant="heading" color={colors.primaryFg} style={styles.initials}>
                {initials(artist.displayName)}
              </Text>
            </View>
          )}
          <View style={styles.levelOnAvatar} accessibilityLabel={`${levelLabel} level`}>
            <ArtistLevelBadge level={level} size={compact ? 18 : 20} />
          </View>
        </View>

        <View style={styles.headerCopy}>
          <View style={styles.nameRow}>
            <Text variant="heading" numberOfLines={1} style={styles.nameText}>
              {artist.displayName}
            </Text>
            {showVerified ? <ArtistVerifiedBadge size={compact ? 15 : 16} /> : null}
          </View>
          {placeLine ? (
            <Text variant="caption" muted numberOfLines={1}>
              {placeLine}
            </Text>
          ) : null}
          {(artist.reviewCount ?? 0) > 0 && artist.averageRating != null ? (
            <View style={styles.ratingRow}>
              <View style={styles.ratingPill} accessibilityLabel={`${artist.averageRating.toFixed(1)} stars`}>
                <Text variant="caption" color={colors.primaryFg}>
                  ★ {artist.averageRating.toFixed(1)}
                </Text>
              </View>
              <Text variant="caption" muted>
                {artist.reviewCount} review{artist.reviewCount === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {showHome || showStudio ? (
        <View style={styles.tags}>
          {showHome ? (
            <View
              style={[styles.placeBadge, artist.coversYourArea && styles.placeBadgeOn]}
              accessibilityLabel={
                artist.coversYourArea ? "Home visits to you" : "Home visits"
              }
            >
              <Icon
                name="home-outline"
                size={13}
                color={artist.coversYourArea ? colors.success : colors.textMuted}
              />
              <Text
                variant="caption"
                color={artist.coversYourArea ? colors.success : colors.textMuted}
              >
                Home
              </Text>
            </View>
          ) : null}
          {showStudio ? (
            <View style={styles.placeBadge} accessibilityLabel="Studio visits">
              <Icon name="storefront-outline" size={13} color={colors.textMuted} />
              <Text variant="caption" muted>
                Salon
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.footer}>
        {artist.startingPrice != null ? (
          <Text variant="body">
            <Text variant="caption" muted>
              from{" "}
            </Text>
            <Text variant="bodyStrong">{rupees(artist.startingPrice)}</Text>
          </Text>
        ) : (
          <View />
        )}

        {artist.offerBadge ? (
          <View style={styles.offerBadge} pointerEvents="none">
            <Text variant="caption" color={colors.primaryFg} style={styles.offerBadgeText}>
              {artist.offerBadge}
            </Text>
          </View>
        ) : (
          <View style={styles.cta}>
            <Text variant="bodyStrong" color={colors.coral}>
              View profile
            </Text>
            <Icon name="chevron-forward" size={16} color={colors.coral} />
          </View>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  cardCompact: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.92 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatarWrap: {
    position: "relative",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C9B8A8",
  },
  initials: {
    fontSize: 16,
    color: colors.primaryFg,
  },
  levelOnAvatar: {
    position: "absolute",
    right: -2,
    bottom: -2,
    borderRadius: 99,
    backgroundColor: colors.card,
    padding: 1,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  nameText: {
    flexShrink: 1,
    minWidth: 0,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
  ratingPill: {
    backgroundColor: colors.coral,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  placeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.muted,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  placeBadgeOn: {
    backgroundColor: "#E5F4EA",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  offerBadge: {
    backgroundColor: colors.coral,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  offerBadgeText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
})
