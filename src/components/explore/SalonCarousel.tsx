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
  title: string
  subtitle?: string
  salons: Salon[]
  onSeeAll?: () => void
}

export function SalonCarousel({ title, subtitle, salons, onSeeAll }: Props) {
  const router = useRouter()
  const { width: windowWidth } = useWindowDimensions()

  if (salons.length === 0) return null

  const gap = spacing.lg
  const padLeft = spacing.lg
  const peek = Math.round(windowWidth * 0.38)
  const cardWidth = Math.min(156, windowWidth - padLeft - gap - peek)

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="heading">{title}</Text>
          {subtitle ? (
            <Text variant="caption" muted style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onSeeAll ? (
          <Pressable accessibilityRole="button" onPress={onSeeAll} hitSlop={8}>
            <Text variant="bodyStrong" color={colors.primary}>
              See all
            </Text>
          </Pressable>
        ) : null}
      </View>

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
          <View key={salon.id} style={{ width: cardWidth }}>
            <SalonCard
              salon={salon}
              layout="carousel"
              onPress={() =>
                router.push({ pathname: "/salon/[id]", params: { id: salon.id } })
              }
            />
          </View>
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
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  scroller: {
    marginHorizontal: -spacing.lg,
  },
  row: {
    gap: spacing.lg,
    paddingRight: spacing.lg,
  },
})
