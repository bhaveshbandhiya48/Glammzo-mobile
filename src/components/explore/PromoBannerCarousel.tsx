import { Image } from "expo-image"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native"

import { colors, radii, spacing } from "@/theme/tokens"

export type PromoBannerItem = {
  id: string
  eyebrow: string
  title: string
  subtitle: string
  tone?: "coral" | "sand" | "dark"
  /** CMS offer banner image — shown full-bleed when present. */
  imageUrl?: string | null
  ctaLabel?: string | null
  promoCode?: string | null
}

type Props = {
  items: PromoBannerItem[]
  onPressItem?: (item: PromoBannerItem) => void
}

export function PromoBannerCarousel({ items, onPressItem }: Props) {
  const { width: windowWidth } = useWindowDimensions()

  const banners = items.filter((item) => Boolean(item.imageUrl?.trim()))
  if (banners.length === 0) return null

  // Leave room so ~25% of the next banner peeks in (matches Explore scroll padding).
  const available = windowWidth - spacing.lg * 2
  const gap = spacing.md
  const cardWidth = Math.round((available - gap) / 1.25)
  const imageHeight = Math.round(cardWidth * 0.42)

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      decelerationRate="fast"
      snapToInterval={cardWidth + gap}
      snapToAlignment="start"
      disableIntervalMomentum
    >
      {banners.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onPressItem?.(item)}
          accessibilityRole="button"
          accessibilityLabel={item.title || "Offer banner"}
          style={({ pressed }) => [
            styles.imageCard,
            { width: cardWidth },
            pressed && styles.pressed,
          ]}
        >
          <Image
            source={{ uri: item.imageUrl! }}
            style={{ width: cardWidth, height: imageHeight }}
            contentFit="cover"
            transition={200}
          />
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  imageCard: {
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.92,
  },
})
