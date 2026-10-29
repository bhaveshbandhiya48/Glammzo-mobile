import { useRouter } from "expo-router"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"

import { Icon } from "@/components/ui/Icon"
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
  // One full card and a peek of the next, so the row reads as scrollable.
  const cardWidth = Math.min(260, Math.round(windowWidth * 0.64))

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
          <Pressable accessibilityRole="button" accessibilityLabel={`See all: ${title}`} onPress={onSeeAll} hitSlop={8} style={styles.seeAll}>
            <Text variant="caption" style={styles.seeAllText}>
              See all
            </Text>
            <Icon name="arrow-forward" size={14} color={colors.text} />
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
    marginBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32,
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: "Geist_600SemiBold",
  },
  scroller: {
    marginHorizontal: -spacing.lg,
  },
  row: {
    gap: spacing.lg,
    paddingRight: spacing.lg,
  },
})
