import { Image } from "expo-image"
import { useState } from "react"
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"

import { Text } from "@/components/ui/Text"
import type { AppOffer } from "@/lib/app-offers-api"
import { colors, fontFamily, spacing } from "@/theme/tokens"

/** The banner image is 0.42 × its width tall (1200 × 504 in the CRM). */
const BANNER_RATIO = 0.42

type Props = {
  offers: AppOffer[]
  onPressOffer: (offer: AppOffer) => void
}

/** Home banners for Glammzo offers, one per slide, with a small pager under them. */
export function AppOfferBanners({ offers, onPressOffer }: Props) {
  const { width: windowWidth } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const banners = offers.filter((offer) => offer.bannerUrl)
  if (banners.length === 0) return null

  const width = windowWidth - spacing.lg * 2
  const height = Math.round(width * BANNER_RATIO)
  const gap = spacing.sm

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / (width + gap))
    setIndex(Math.max(0, Math.min(next, banners.length - 1)))
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={width + gap}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={{ gap }}
        onMomentumScrollEnd={onMomentumEnd}
      >
        {banners.map((offer) => (
          <Pressable
            key={offer.id}
            onPress={() => onPressOffer(offer)}
            accessibilityRole="button"
            accessibilityLabel={`${offer.headline}. ${offer.title}`}
            style={({ pressed }) => [styles.banner, { width, height }, pressed && styles.pressed]}
          >
            <Image
              source={{ uri: offer.bannerUrl! }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
            {offer.code && !offer.autoApply ? (
              <View style={styles.codeTag}>
                <Text style={styles.codeText}>{offer.code}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
      {banners.length > 1 ? (
        <View
          style={styles.pager}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {banners.map((offer, position) => (
            <View key={offer.id} style={[styles.dot, position === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  banner: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.muted,
  },
  pressed: {
    opacity: 0.92,
  },
  codeTag: {
    position: "absolute",
    left: 10,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(17,17,17,0.82)",
  },
  codeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.5,
    color: "#FFFFFF",
  },
  pager: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.text,
  },
})
