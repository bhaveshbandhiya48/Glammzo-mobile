import { Image } from "expo-image"
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

import { ArtistLevelBadge } from "@/components/artists/ArtistLevelBadge"
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
  /** Tighter layout for 2-up grids (artists list). */
  grid?: boolean
  style?: StyleProp<ViewStyle>
}

/** Photo-led artist card, matching the salon card: cover photo, avatar on it, quiet rating and price. */
export function ArtistCard({
  artist,
  categoryLabel,
  onPress,
  compact = false,
  grid = false,
  style,
}: Props) {
  const distance =
    artist.distanceKm != null
      ? artist.distanceKm < 10
        ? `${artist.distanceKm.toFixed(1)} km`
        : `${Math.round(artist.distanceKm)} km`
      : null
  const placeLine = [artist.area?.trim() || null, distance].filter(Boolean).join(" · ")
  const cover = artist.portfolio.find(Boolean) ?? artist.profilePhotoUrl
  // Every card with a portfolio cover gets the round avatar; initials stand in for a missing photo.
  const showAvatar = Boolean(cover) && cover !== artist.profilePhotoUrl
  const level = parseArtistLevel(artist.level)
  const levelLabel = artistLevelLabel(level, artist.levelLabel)
  const showLevel = showArtistLevelToCustomers(level)
  const hasRating = (artist.reviewCount ?? 0) > 0 && artist.averageRating != null
  const visit = visitLine(artist)
  const speciality = artist.primaryCategory ? categoryLabel(artist.primaryCategory) : null

  const avatarSize = grid ? GRID_AVATAR : AVATAR
  const levelSize = grid ? 14 : showAvatar ? 16 : 18

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        artist.displayName,
        showLevel ? levelLabel : null,
        speciality,
        placeLine || null,
        hasRating ? `${artist.averageRating!.toFixed(1)} stars, ${artist.reviewCount} reviews` : "new",
        visit,
        artist.startingPrice != null ? `from ${formatRupees(artist.startingPrice)}` : null,
        artist.offerBadge ? `offer ${artist.offerBadge}` : null,
      ]
        .filter(Boolean)
        .join(", ")}
      style={({ pressed }) => [styles.card, grid && styles.cardGrid, style, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.photo,
          compact && styles.photoCompact,
          grid && styles.photoGrid,
        ]}
      >
        {cover ? (
          <Image source={{ uri: cover }} style={styles.photoImage} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.photoImage, styles.photoFallback]}>
            <Text variant={grid ? "bodyStrong" : "title"} color={colors.textMuted}>
              {initials(artist.displayName)}
            </Text>
          </View>
        )}
        {artist.offerBadge ? (
          <View style={[styles.offer, grid && styles.offerGrid]} pointerEvents="none">
            <Text variant="caption" style={[styles.offerText, grid && styles.offerTextGrid]} numberOfLines={1}>
              {artist.offerBadge}
            </Text>
          </View>
        ) : null}
        {showAvatar ? (
          <View
            style={[
              styles.avatarRing,
              grid && styles.avatarRingGrid,
              {
                width: avatarSize + 4,
                height: avatarSize + 4,
                borderRadius: (avatarSize + 4) / 2,
                bottom: -avatarSize / 2,
              },
            ]}
          >
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
                  styles.photoFallback,
                  {
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                    backgroundColor: colors.muted,
                  },
                ]}
              >
                <Text variant="caption" style={styles.offerText} color={colors.text}>
                  {initials(artist.displayName)}
                </Text>
              </View>
            )}
            {showLevel ? (
              <View style={styles.levelOnAvatar} accessibilityLabel={`${levelLabel} level`}>
                <ArtistLevelBadge level={level} size={levelSize} />
              </View>
            ) : null}
          </View>
        ) : showLevel ? (
          <View
            style={[styles.levelOnPhoto, grid && styles.levelOnPhotoGrid]}
            accessibilityLabel={`${levelLabel} level`}
            pointerEvents="none"
          >
            <ArtistLevelBadge level={level} size={levelSize} />
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.body,
          grid && styles.bodyGrid,
          showAvatar && (grid ? styles.bodyWithAvatarGrid : styles.bodyWithAvatar),
        ]}
      >
        <View style={styles.nameRow}>
          <Text
            variant="bodyStrong"
            numberOfLines={1}
            style={[styles.name, grid && styles.nameGrid]}
          >
            {artist.displayName}
          </Text>
        </View>
        {placeLine || speciality ? (
          <Text variant="caption" muted numberOfLines={1}>
            {[speciality, placeLine].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        <Text variant="caption" numberOfLines={1} style={styles.meta}>
          {hasRating ? `★ ${artist.averageRating!.toFixed(1)}` : "New"}
          {!grid && visit ? (
            <Text variant="caption" muted>
              {`  ·  ${visit}`}
            </Text>
          ) : null}
        </Text>
        {artist.startingPrice != null ? (
          <Text variant="bodyStrong" style={[styles.price, grid && styles.priceGrid]}>
            from {formatRupees(artist.startingPrice)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const AVATAR = 40
const GRID_AVATAR = 32

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    ...shadows.card,
  },
  cardGrid: {
    flex: 1,
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
  photoGrid: {
    height: 128,
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
    maxWidth: "85%",
  },
  offerGrid: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    left: spacing.sm,
    top: spacing.sm,
  },
  offerText: {
    fontFamily: "Geist_600SemiBold",
    color: colors.text,
  },
  offerTextGrid: {
    fontSize: 11,
  },
  avatarRing: {
    position: "absolute",
    left: spacing.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  avatarRingGrid: {
    left: spacing.sm,
  },
  levelOnAvatar: {
    position: "absolute",
    right: -3,
    bottom: -3,
    borderRadius: 99,
    backgroundColor: colors.surface,
    padding: 1,
  },
  levelOnPhoto: {
    position: "absolute",
    left: spacing.md,
    bottom: spacing.md,
    borderRadius: 99,
    backgroundColor: colors.surface,
    padding: 2,
  },
  levelOnPhotoGrid: {
    left: spacing.sm,
    bottom: spacing.sm,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: 2,
  },
  bodyGrid: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  bodyWithAvatar: {
    paddingTop: spacing.xl,
  },
  bodyWithAvatarGrid: {
    paddingTop: spacing.lg + 4,
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
  nameGrid: {
    fontSize: 14,
  },
  meta: {
    marginTop: 4,
  },
  price: {
    marginTop: 4,
  },
  priceGrid: {
    fontSize: 13,
    marginTop: 2,
  },
})
