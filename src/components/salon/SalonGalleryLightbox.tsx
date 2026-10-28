import { Image } from "expo-image"
import { StatusBar } from "expo-status-bar"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ListViewToken as ViewToken,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  visible: boolean
  gallery: string[]
  salonName: string
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

export function SalonGalleryLightbox({
  visible,
  gallery,
  salonName,
  index,
  onClose,
  onIndexChange,
}: Props) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const listRef = useRef<FlatList<string>>(null)
  const [activeIndex, setActiveIndex] = useState(index)

  useEffect(() => {
    if (!visible) return
    setActiveIndex(index)
    const timer = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated: false })
    })
    return () => cancelAnimationFrame(timer)
  }, [visible, index])

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const next = viewableItems[0]?.index
      if (typeof next === "number" && next >= 0) {
        setActiveIndex(next)
        onIndexChange(next)
      }
    },
  ).current

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current

  const goPrev = useCallback(() => {
    if (gallery.length < 2) return
    const next = (activeIndex - 1 + gallery.length) % gallery.length
    listRef.current?.scrollToIndex({ index: next, animated: true })
    setActiveIndex(next)
    onIndexChange(next)
  }, [activeIndex, gallery.length, onIndexChange])

  const goNext = useCallback(() => {
    if (gallery.length < 2) return
    const next = (activeIndex + 1) % gallery.length
    listRef.current?.scrollToIndex({ index: next, animated: true })
    setActiveIndex(next)
    onIndexChange(next)
  }, [activeIndex, gallery.length, onIndexChange])

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1))
    if (next !== activeIndex && next >= 0 && next < gallery.length) {
      setActiveIndex(next)
      onIndexChange(next)
    }
  }

  if (!gallery.length) return null

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar style="light" />
      <View style={styles.root}>
        <View
          style={[
            styles.topBar,
            { paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm },
          ]}
        >
          <Text variant="caption" color="rgba(255,255,255,0.8)">
            {activeIndex + 1} / {gallery.length}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close gallery"
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}
          >
            <Icon name="close" size={22} color={colors.primaryFg} />
          </Pressable>
        </View>

        <View style={styles.stage}>
          <FlatList
            ref={listRef}
            style={styles.list}
            data={gallery}
            keyExtractor={(uri, i) => `${uri}-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={gallery.length > 1}
            initialScrollIndex={Math.min(index, gallery.length - 1)}
            getItemLayout={(_, i) => ({
              length: width,
              offset: width * i,
              index: i,
            })}
            onMomentumScrollEnd={onMomentumEnd}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScrollToIndexFailed={({ index: failedIndex }) => {
              requestAnimationFrame(() => {
                listRef.current?.scrollToIndex({
                  index: failedIndex,
                  animated: false,
                })
              })
            }}
            renderItem={({ item, index: itemIndex }) => (
              <View style={[styles.slide, { width }]}>
                <Image
                  source={{ uri: item }}
                  style={styles.image}
                  contentFit="contain"
                  accessibilityLabel={`${salonName} gallery photo ${itemIndex + 1}`}
                />
              </View>
            )}
          />

          {gallery.length > 1 ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous photo"
                onPress={goPrev}
                style={[styles.navBtn, styles.navPrev]}
              >
                <Icon name="chevron-back" size={28} color={colors.primaryFg} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next photo"
                onPress={goNext}
                style={[styles.navBtn, styles.navNext]}
              >
                <Icon name="chevron-forward" size={28} color={colors.primaryFg} />
              </Pressable>
            </>
          ) : null}
        </View>

        {gallery.length > 1 ? (
          <Text
            variant="caption"
            color="rgba(255,255,255,0.5)"
            style={[styles.hint, { paddingBottom: insets.bottom + spacing.md }]}
          >
            Swipe left or right to browse
          </Text>
        ) : (
          <View style={{ height: insets.bottom + spacing.md }} />
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  stage: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
  },
  list: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  navBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    zIndex: 2,
  },
  navPrev: {
    left: spacing.sm,
  },
  navNext: {
    right: spacing.sm,
  },
  hint: {
    textAlign: "center",
    paddingTop: spacing.sm,
  },
})
