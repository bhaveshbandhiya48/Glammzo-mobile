import { Image } from "expo-image"
import { useEffect, useRef, useState } from "react"
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
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
                {entry.totalLabel} · {entry.itemCount} {itemWord}
                {entry.previewLabel ? ` · ${entry.previewLabel}` : ""}
              </Text>
            </View>
          </View>

          <View style={styles.cta}>
            <Text variant="bodyStrong" color={colors.primary}>
              {ctaLabel}
            </Text>
            <Icon name="chevron-forward" size={18} color={colors.primary} />
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

/** Collapsed bag: a small floating pill (photos, count, total). Tap to open the full bar. */
function MiniBag({ entries, onOpen }: { entries: CartStripEntry[]; onOpen: () => void }) {
  const count = entries.reduce((sum, entry) => sum + entry.itemCount, 0)
  const thumbs = entries.flatMap((entry) => entry.imageUrls ?? []).slice(0, 2)
  const label = entries.length === 1 ? entries[0]!.totalLabel : `${entries.length} places`
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Bag, ${count} ${count === 1 ? "item" : "items"}, ${label}. Open bag bar`}
      onPress={onOpen}
      style={({ pressed }) => [styles.mini, pressed && styles.pressed]}
    >
      {thumbs.length > 0 ? (
        <View style={styles.thumbs}>
          {thumbs.map((uri, index) => (
            <Image
              key={`${uri}-${index}`}
              source={{ uri }}
              style={[styles.miniThumb, { marginLeft: index === 0 ? 0 : -12, zIndex: thumbs.length - index }]}
              contentFit="cover"
            />
          ))}
        </View>
      ) : (
        <Icon name="bag-handle" size={20} color={colors.primaryFg} />
      )}
      <Text variant="bodyStrong" color={colors.primaryFg}>
        {label}
      </Text>
      <View style={styles.miniCount}>
        <Text variant="caption" color={colors.primary} style={styles.miniCountText}>
          {count}
        </Text>
      </View>
    </Pressable>
  )
}

export function CartStrip({ entries, bottomOffset = 0 }: Props) {
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const [page, setPage] = useState(0)
  // Instagram-style: stays a small pill until tapped, then zooms open into the full bar.
  const [expanded, setExpanded] = useState(false)
  const zoom = useRef(new Animated.Value(0)).current
  const itemTotal = entries.reduce((sum, entry) => sum + entry.itemCount, 0)
  const lastTotal = useRef(itemTotal)

  useEffect(() => {
    Animated.spring(zoom, {
      toValue: expanded ? 1 : 0,
      damping: 18,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start()
  }, [expanded, zoom])

  // Adding something pops the pill once so it's noticed, without taking over the screen.
  const pop = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (itemTotal > lastTotal.current && !expanded) {
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.12, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, damping: 10, stiffness: 260, useNativeDriver: true }),
      ]).start()
    }
    lastTotal.current = itemTotal
  }, [expanded, itemTotal, pop])
  const sliderRef = useRef<ScrollViewInstance>(null)
  const sidePad = spacing.lg
  const gap = spacing.sm
  const slideWidth =
    entries.length > 1 ? windowWidth - sidePad * 2 - 28 : windowWidth - sidePad * 2

  if (entries.length === 0) return null

  const barStyle = {
    opacity: zoom,
    transform: [
      { scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
      { translateY: zoom.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
    ],
  }

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
      {!expanded ? (
        <Animated.View style={[styles.miniWrap, { transform: [{ scale: pop }] }]}>
          <MiniBag entries={entries} onOpen={() => setExpanded(true)} />
        </Animated.View>
      ) : null}
      {expanded ? (
        <Animated.View style={barStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Minimise bag bar"
            hitSlop={8}
            onPress={() => setExpanded(false)}
            style={styles.minimise}
          >
            <Icon name="chevron-down" size={18} color={colors.text} />
          </Pressable>
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
        </Animated.View>
      ) : null}
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
  miniWrap: {
    alignSelf: "flex-start",
  },
  mini: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.hero,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  miniThumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.hero,
  },
  miniCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  miniCountText: {
    fontFamily: "Geist_700Bold",
  },
  minimise: {
    alignSelf: "center",
    width: 40,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  bar: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: colors.hero,
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
    backgroundColor: colors.primary,
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.primary,
    width: 14,
  },
})
