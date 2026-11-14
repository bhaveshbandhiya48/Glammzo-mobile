import { Image } from "expo-image"
import { useRef, useState } from "react"
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useFloatingTabBarTop } from "@/components/ui/FloatingTabBar"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

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
  /** Sits just above the floating bottom bar instead of the screen edge. */
  aboveTabBar?: boolean
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
          accessibilityLabel={`Clear bag for ${entry.salonName}`}
          hitSlop={8}
          onPress={entry.onClear}
          style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
        >
          <Icon name="close" size={16} color="#ffffff" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${ctaLabel} for ${entry.salonName}, ${entry.itemCount} ${itemWord}, ${entry.totalLabel}`}
          onPress={entry.onPress}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        >
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
          ) : null}
          <View style={styles.copy}>
            <Text style={styles.total} numberOfLines={1}>
              {entry.totalLabel}
              <Text style={styles.name}>{` · ${entry.salonName}`}</Text>
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {entry.itemCount} {itemWord}
              {entry.previewLabel ? ` · ${entry.previewLabel}` : ""}
            </Text>
          </View>

          <View style={styles.cta}>
            <Text style={styles.ctaText} numberOfLines={1}>
              {ctaLabel} →
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

export function CartStrip({ entries, bottomOffset = 0, aboveTabBar = false }: Props) {
  const insets = useSafeAreaInsets()
  const tabBarTop = useFloatingTabBarTop()
  const { width: windowWidth } = useWindowDimensions()
  const [page, setPage] = useState(0)
  const sliderRef = useRef<ScrollViewInstance>(null)
  const sidePad = 14
  const gap = 8
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
          paddingBottom: aboveTabBar ? tabBarTop + 8 : Math.max(insets.bottom, 12) + bottomOffset,
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
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  slide: {},
  bar: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 22,
    backgroundColor: "#111111",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      default: { elevation: 10 },
    }),
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.88,
  },
  thumbs: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumb: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#111111",
    backgroundColor: "#2b2b2b",
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  total: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 19,
    color: "#ffffff",
  },
  name: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: "#d4d4d4",
  },
  sub: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: "#d4d4d4",
  },
  cta: {
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    lineHeight: 18,
    color: "#111111",
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  dots: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  dotActive: {
    backgroundColor: "#111111",
    width: 16,
  },
})
