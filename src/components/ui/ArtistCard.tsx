import { Image } from "expo-image"
import { useRouter, type Href } from "expo-router"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { ArtistCardData } from "@/lib/artists-api"
import { colors, radii, shadows, spacing } from "@/theme/tokens"

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

/** How many portfolio thumbs to show before a “View more” tile. */
const PORTFOLIO_PREVIEW = 5

type Props = {
  artist: ArtistCardData
  categoryLabel: (id: string) => string
  onPress: () => void
  /** Smaller card for home / horizontal sliders. */
  compact?: boolean
}

export function ArtistCard({ artist, categoryLabel, onPress, compact = false }: Props) {
  const router = useRouter()
  const where = [artist.area, artist.city].filter(Boolean).join(", ")
  const homeLabel = compact
    ? artist.coversYourArea
      ? "To you"
      : "Home"
    : artist.coversYourArea
      ? "Travels to you"
      : `Home visits${artist.serviceRadiusKm ? ` · ${Math.round(artist.serviceRadiusKm)} km` : ""}`

  const portfolio = artist.portfolio
  const useSlider = portfolio.length > 3
  const preview = portfolio.slice(0, PORTFOLIO_PREVIEW)
  const showViewMore = portfolio.length > 3
  const extraCount = Math.max(0, portfolio.length - PORTFOLIO_PREVIEW)

  function openPortfolio() {
    router.push({
      pathname: "/artist/[slug]",
      params: {
        slug: artist.slug,
        name: artist.displayName,
        focus: "portfolio",
      },
    } as Href)
  }

  const thumbStyle = [styles.thumb, compact && styles.thumbCompact]

  const portfolioTiles = (
    <>
      {preview.map((uri) => (
        <Pressable
          key={uri}
          onPress={openPortfolio}
          accessibilityRole="button"
          accessibilityLabel="View portfolio"
        >
          <Image source={{ uri }} style={thumbStyle} contentFit="cover" />
        </Pressable>
      ))}
      {showViewMore ? (
        <Pressable
          onPress={openPortfolio}
          accessibilityRole="button"
          accessibilityLabel="View more portfolio photos"
          style={({ pressed }) => [
            styles.thumb,
            compact && styles.thumbCompact,
            styles.viewMore,
            pressed && { opacity: 0.88 },
          ]}
        >
          {extraCount > 0 ? (
            <Text variant="caption" color={colors.coral} style={styles.viewMoreText}>
              +{extraCount}
            </Text>
          ) : null}
          <Text variant="caption" color={colors.coral} style={styles.viewMoreText}>
            View more
          </Text>
        </Pressable>
      ) : null}
    </>
  )

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${artist.displayName}, ${where}`}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <View style={styles.top}>
          {artist.profilePhotoUrl ? (
            <Image source={{ uri: artist.profilePhotoUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text variant="heading" color={colors.coral}>
                {artist.displayName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.info}>
            <Text variant="heading" numberOfLines={1}>
              {artist.displayName}
            </Text>
            {where ? (
              <Text variant="caption" muted numberOfLines={1}>
                {where}
                {artist.distanceKm != null
                  ? ` · ${artist.distanceKm < 10 ? artist.distanceKm.toFixed(1) : Math.round(artist.distanceKm)} km`
                  : ""}
              </Text>
            ) : null}
            <Text variant="caption" muted numberOfLines={1} style={{ marginTop: 2 }}>
              {artist.categories.slice(0, 3).map(categoryLabel).join(" · ")}
              {artist.yearsExperience ? ` · ${artist.yearsExperience}+ yrs` : ""}
            </Text>
            {artist.startingPrice != null ? (
              <Text variant="heading" numberOfLines={1} style={styles.price}>
                from {rupees(artist.startingPrice)}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      {portfolio.length > 0 ? (
        useSlider ? (
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
          >
            {portfolioTiles}
          </ScrollView>
        ) : (
          <View style={styles.strip}>{portfolioTiles}</View>
        )
      ) : null}

      {artist.offersHomeVisits || artist.hasStudio ? (
        <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
          <View style={styles.badges}>
            {artist.offersHomeVisits ? (
              <View style={[styles.badge, artist.coversYourArea && styles.badgeOn]}>
                <Icon
                  name="home-outline"
                  size={13}
                  color={artist.coversYourArea ? colors.success : colors.textMuted}
                />
                <Text
                  variant="caption"
                  color={artist.coversYourArea ? colors.success : colors.textMuted}
                >
                  {homeLabel}
                </Text>
              </View>
            ) : null}
            {artist.hasStudio ? (
              <View style={styles.badge}>
                <Icon name="storefront-outline" size={13} color={colors.textMuted} />
                <Text variant="caption" muted>
                  Studio
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      ) : null}
    </View>
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
  pressed: { opacity: 0.9 },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.muted },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  info: { flex: 1, minWidth: 0 },
  strip: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  thumbCompact: {
    width: 56,
    height: 56,
  },
  viewMore: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8EDE8",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(232, 120, 90, 0.35)",
    gap: 2,
    paddingHorizontal: 4,
  },
  viewMoreText: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14,
  },
  price: {
    marginTop: 4,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.muted,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 1,
  },
  badgeOn: { backgroundColor: "#E5F4EA" },
})
