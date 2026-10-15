import { Image } from "expo-image"
import { useRef, useState } from "react"
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { colors, radii, spacing } from "@/theme/tokens"

export type CartStripEntry = {
  salonId: string
  salonName: string
  itemCount: number
  totalLabel: string
  imageUrls?: string[]
  previewLabel?: string
  ctaLabel?: string
  onPress: () => void
  onClear: () => void
}

type Props = {
  entries: CartStripEntry[]
  bottomOffset?: number
}

function StripCard({
  entry,
  width,
}: {
  entry: CartStripEntry
  width: number
}) {
  const thumbs = (entry.imageUrls ?? []).slice(0, 3)
  const itemWord = entry.itemCount === 1 ? "item" : "items"
  const ctaLabel = entry.ctaLabel ?? "View bag"

  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View bag for ${entry.salonName}, ${entry.itemCount} ${itemWord}`}
          onPress={entry.onPress}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        >
          <View style={styles.left}>
            {thumbs.length > 0 ? (
              <View style={styles.thumbs}>
                {thumbs.map((uri, index) => (
                  <Image
                    key={`${entry.salonId}-${uri}-${index}`}
                    source={{ uri }}
                    style={[
                      styles.thumb,
                      {
                        marginLeft: index === 0 ? 0 : -10,
                        zIndex: thumbs.length - index,
                      },
                    ]}
                    contentFit="cover"
                  />
                ))}
              </View>
            ) : (
              <View style={styles.countBadge}>
                <Text variant="caption" color={colors.primaryFg}>
                  {entry.itemCount}
                </Text>
              </View>
            )}
            <View style={styles.copy}>
              <Text variant="bodyStrong" color={colors.primaryFg} numberOfLines={1}>
                {entry.salonName}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.72)" numberOfLines={1}>
                {entry.itemCount} {itemWord}
                {entry.previewLabel ? ` · ${entry.previewLabel}` : ""} · {entry.totalLabel}
              </Text>
            </View>
          </View>

          <View style={styles.cta}>
            <Text variant="bodyStrong" color={colors.primaryFg}>
              {ctaLabel}
            </Text>
            <Icon name="chevron-forward" size={18} color={colors.primaryFg} />
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear bag for ${entry.salonName}`}
          hitSlop={8}
          onPress={entry.onClear}
          style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
        >
          <Icon name="close" size={18} color={colors.primaryFg} />
        </Pressable>
      </View>
    </View>
  )
}

export function CartStrip({ entries, bottomOffset = 0 }: Props) {
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const [page, setPage] = useState(0)
  const sliderRef = useRef<ScrollView>(null)
  const sidePad = spacing.lg
  const gap = spacing.sm
  const slideWidth =
    entries.length > 1 ? windowWidth - sidePad * 2 - 28 : windowWidth - sidePad * 2

  if (entries.length === 0) return null

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / (slideWidth + gap))
    if (next !== page) setPage(next)
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          paddingBottom: Math.max(insets.bottom, spacing.md) + bottomOffset,
        },
      ]}
    >
      {entries.length === 1 ? (
        <StripCard entry={entries[0]!} width={slideWidth} />
      ) : (
        <>
          <ScrollView
            ref={sliderRef}
            horizontal
            pagingEnabled={false}
            decelerationRate="fast"
            snapToInterval={slideWidth + gap}
            snapToAlignment="start"
            disableIntervalMomentum
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            contentContainerStyle={{ gap }}
          >
            {entries.map((entry) => (
              <StripCard key={entry.salonId} entry={entry} width={slideWidth} />
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {entries.map((entry, index) => (
              <View
                key={entry.salonId}
                style={[styles.dot, index === page && styles.dotActive]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  )
}

/** @deprecated use CartStrip with entries — kept name for imports */
export default CartStrip

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  slide: {},
  bar: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: "#1C1C1C",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.88,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minWidth: 0,
  },
  thumbs: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: "#1C1C1C",
    backgroundColor: colors.muted,
  },
  countBadge: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.coral,
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  dots: {
    marginTop: spacing.sm,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  dotActive: {
    backgroundColor: colors.coral,
    width: 14,
  },
})
