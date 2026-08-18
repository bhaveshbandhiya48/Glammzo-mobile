import { useRouter } from "expo-router"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"

import { SalonCard } from "@/components/ui/SalonCard"
import { Text } from "@/components/ui/Text"
import type { Salon } from "@/data/types"
import { colors, spacing } from "@/theme/tokens"

type Props = {
  salons: Salon[]
}

export function FeaturedSalonCarousel({ salons }: Props) {
  const router = useRouter()
  const { width: windowWidth } = useWindowDimensions()

  if (salons.length === 0) return null

  const gap = spacing.md
  const padLeft = spacing.lg
  // Keep a clear peek of the next card, flush to the screen edge (no right gutter).
  const peek = Math.round(windowWidth * 0.22)
  const cardWidth = Math.min(220, windowWidth - padLeft - gap - peek)

  return (
    <View style={styles.wrap}>
      <Text variant="label" color={colors.text} style={styles.title}>
        Featured
      </Text>

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={[styles.row, { paddingLeft: padLeft }]}
        decelerationRate="fast"
        snapToInterval={cardWidth + gap}
        snapToAlignment="start"
        disableIntervalMomentum
      >
        {salons.map((salon) => (
          <Pressable
            key={salon.id}
            style={{ width: cardWidth }}
            onPress={() =>
              router.push({ pathname: "/salon/[id]", params: { id: salon.id } })
            }
          >
            <SalonCard
              salon={salon}
              layout="carousel"
              onPress={() =>
                router.push({ pathname: "/salon/[id]", params: { id: salon.id } })
              }
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    letterSpacing: 1.6,
  },
  // Cancel Explore content padding so the peek reaches the screen edge.
  scroller: {
    marginHorizontal: -spacing.lg,
  },
  row: {
    gap: spacing.md,
    // Match content inset so the last card isn't flush to the screen edge.
    paddingRight: spacing.lg,
  },
})
