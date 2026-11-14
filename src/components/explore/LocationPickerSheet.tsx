import { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputInstance,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GradientFill } from "@/components/home/GradientFill"
import { PastelIcon } from "@/components/profile/ProfileParts"
import { pastels, sp, ui } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { SkeletonBone } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { useSheetAnimation } from "@/components/ui/useSheetAnimation"
import type { PlacePrediction } from "@/lib/location-api"
import { colors, fontFamily, spacing } from "@/theme/tokens"

type Props = {
  visible: boolean
  onClose: () => void
  query: string
  onQueryChange: (value: string) => void
  currentLabel: string
  nearbyAreas: PlacePrediction[]
  nearbyLoading?: boolean
  predictions: PlacePrediction[]
  placesLoading: boolean
  placesError: string | null
  nearMeLoading: boolean
  onUseCurrentLocation: () => void
  onPickPrediction: (prediction: PlacePrediction) => void
  /** Open with the keyboard up, ready to type. */
  focusOnOpen?: boolean
}

const WINDOW_HEIGHT = Dimensions.get("window").height
const COLLAPSED_HEIGHT = Math.min(WINDOW_HEIGHT * 0.58, 500)
const TOP_MARGIN = WINDOW_HEIGHT * 0.2
const DISMISS_DISTANCE = 80
const DISMISS_VELOCITY = 0.9

/**
 * Search focus: same UI, sheet pulls under a 20% top margin immediately.
 * Typing shows suggested areas.
 */
export function LocationPickerSheet({
  visible,
  onClose,
  query,
  onQueryChange,
  currentLabel,
  nearbyAreas = [],
  nearbyLoading = false,
  predictions = [],
  placesLoading,
  placesError,
  nearMeLoading,
  onUseCurrentLocation,
  onPickPrediction,
  focusOnOpen = false,
}: Props) {
  const insets = useSafeAreaInsets()
  const inputRef = useRef<TextInputInstance>(null)

  useEffect(() => {
    if (!visible || !focusOnOpen) return
    // After the sheet has slid in, or the keyboard interrupts its animation.
    const timer = setTimeout(() => inputRef.current?.focus(), 280)
    return () => clearTimeout(timer)
  }, [focusOnOpen, visible])
  const [searchFocused, setSearchFocused] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const dragY = useRef(new Animated.Value(0)).current
  const sheetAnim = useSheetAnimation(visible)
  const scrollOffsetRef = useRef(0)
  const closingRef = useRef(false)

  useEffect(() => {
    if (!visible) {
      setSearchFocused(false)
      setKeyboardHeight(0)
      scrollOffsetRef.current = 0
      return
    }
    // Reopened (possibly while the previous close was still sliding out): start clean.
    closingRef.current = false
    dragY.setValue(0)

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height)
    })
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0)
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [dragY, visible])

  // Reset the drag offset only after the modal is fully gone, so a swiped-away sheet
  // never jumps back to its open position on the way out.
  useEffect(() => {
    if (sheetAnim.mounted) return
    dragY.setValue(0)
    closingRef.current = false
  }, [dragY, sheetAnim.mounted])

  function finishClose() {
    Keyboard.dismiss()
    setSearchFocused(false)
    onClose()
  }

  /** Close (X), backdrop tap and back button: the hook's slide-down + fade. */
  function handleClose() {
    if (closingRef.current) return
    closingRef.current = true
    finishClose()
  }

  function snapBack() {
    if (closingRef.current) return
    Animated.spring(dragY, {
      toValue: 0,
      bounciness: 0,
      useNativeDriver: true,
    }).start()
  }

  /**
   * One continuous motion: carry the sheet from where the finger let go all the way off
   * screen while the backdrop fades, then close. The hook is told to skip its own exit
   * slide, and dragY is only reset once the modal has unmounted — resetting it earlier
   * snapped the sheet back open for a frame and made it look like it reopened.
   */
  function dismissWithDrag(currentY: number, velocityY: number) {
    if (closingRef.current) return
    // Lock out further drags, snap-backs and taps while it slides away.
    closingRef.current = true
    dragY.stopAnimation()
    const remaining = Math.max(0, WINDOW_HEIGHT - currentY)
    const speed = Math.max(velocityY, 1.2) // px per ms
    const duration = Math.min(260, Math.max(140, remaining / speed))
    Animated.parallel([
      Animated.timing(dragY, {
        toValue: WINDOW_HEIGHT,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetAnim.backdropOpacity, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start(() => {
      sheetAnim.markDragDismissed()
      finishClose()
    })
  }

  const keyboardOpen = keyboardHeight > 0

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !keyboardOpen && !closingRef.current,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !keyboardOpen &&
          !closingRef.current &&
          gesture.dy > 4 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_event, gesture) => {
          dragY.setValue(Math.max(0, gesture.dy))
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
            dismissWithDrag(gesture.dy, gesture.vy)
            return
          }
          snapBack()
        },
        onPanResponderTerminate: snapBack,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragY, keyboardOpen, onClose],
  )

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => {
          if (keyboardOpen || closingRef.current) return false
          const pullingDown =
            gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx)
          if (!pullingDown) return false
          return scrollOffsetRef.current <= 0
        },
        onMoveShouldSetPanResponderCapture: (_event, gesture) => {
          if (keyboardOpen || closingRef.current) return false
          const pullingDown =
            gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx)
          if (!pullingDown) return false
          return scrollOffsetRef.current <= 0
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_event, gesture) => {
          dragY.setValue(Math.max(0, gesture.dy))
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
            dismissWithDrag(gesture.dy, gesture.vy)
            return
          }
          snapBack()
        },
        onPanResponderTerminate: snapBack,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragY, keyboardOpen, onClose],
  )

  function onBodyScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y)
  }

  const typing = query.trim().length > 0
  // Pull up as soon as the field is focused — don't wait for keyboard hide.
  const pulledUp = searchFocused || typing

  return (
    <Modal
      visible={sheetAnim.mounted}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.root,
          pulledUp
            ? {
                // Pin sheet under 20% top margin, above the keyboard.
                paddingTop: TOP_MARGIN,
                paddingBottom: keyboardHeight,
                justifyContent: "flex-start",
              }
            : {
                justifyContent: "flex-end",
                paddingBottom: 0,
              },
        ]}
      >
        <Animated.View style={[styles.backdrop, { opacity: sheetAnim.backdropOpacity }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            pulledUp
              ? styles.sheetPulledUp
              : {
                  height: COLLAPSED_HEIGHT,
                  paddingBottom: Math.max(insets.bottom, spacing.lg),
                },
            { transform: [{ translateY: Animated.add(sheetAnim.sheetY, dragY) }] },
          ]}
          {...sheetPanResponder.panHandlers}
        >
          <View style={styles.top}>
            <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />
            <View style={styles.handleHit} {...handlePanResponder.panHandlers}>
              <View style={styles.handle} />
            </View>

            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">
                Choose location
              </Text>
              <Pressable
                onPress={handleClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [styles.closeBtn, pressed && ui.pressed]}
              >
                <Icon name="close" size={20} color={sp.text} />
              </Pressable>
            </View>

            <View style={[styles.searchField, inputFocused && styles.searchFieldFocused]}>
              <Icon name="search-outline" size={18} color={sp.secondary} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={onQueryChange}
                onFocus={() => {
                  setSearchFocused(true)
                  setInputFocused(true)
                }}
                onBlur={() => {
                  setInputFocused(false)
                  setTimeout(() => {
                    if ((query || "").trim().length === 0) {
                      setSearchFocused(false)
                    }
                  }, 180)
                }}
                placeholder="Search area, street, landmark…"
                placeholderTextColor="#8a8a8a"
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="words"
                clearButtonMode="never"
                accessibilityLabel="Search location"
              />
              {query.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onQueryChange("")
                    inputRef.current?.focus()
                  }}
                  hitSlop={8}
                  accessibilityLabel="Clear search"
                >
                  <Icon name="close-circle" size={18} color="#8a8a8a" />
                </Pressable>
              ) : null}
            </View>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces
            nestedScrollEnabled
            scrollEventThrottle={16}
            onScroll={onBodyScroll}
          >
            {placesError ? (
              <View style={styles.errorCard} accessibilityRole="alert">
                <Icon name="alert-circle-outline" size={18} color={sp.peachInk} />
                <Text style={styles.errorText}>{placesError}</Text>
              </View>
            ) : null}

            {!typing ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Use current location"
                  accessibilityState={{ busy: nearMeLoading, disabled: nearMeLoading }}
                  style={({ pressed }) => [
                    styles.card,
                    styles.nearMe,
                    pressed && ui.pressed,
                  ]}
                  onPress={() => {
                    if (!nearMeLoading) onUseCurrentLocation()
                  }}
                  disabled={nearMeLoading}
                >
                  {nearMeLoading ? (
                    <View style={styles.spinnerBox}>
                      <ActivityIndicator color={sp.peachInk} />
                    </View>
                  ) : (
                    <PastelIcon pastel={pastels.peach} name="navigate" />
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>Use current location</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {nearMeLoading ? "Finding where you are…" : "Using GPS for precise area"}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={sp.secondary} />
                </Pressable>

                <Text style={[ui.sectionLabel, styles.sectionLabel]}>Nearby areas</Text>
                {nearbyLoading ? (
                  <RowsSkeleton label="Finding nearby areas" />
                ) : nearbyAreas.length === 0 ? (
                  <View style={[styles.card, styles.hintCard]}>
                    <Text style={styles.rowSub}>
                      No nearby areas yet. Search for a place above.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.card}>
                    {nearbyAreas.slice(0, 3).map((area, index) => {
                      const selected =
                        currentLabel === area.primaryText ||
                        currentLabel.startsWith(`${area.primaryText},`)
                      return (
                        <PlaceRow
                          key={area.placeId || area.primaryText}
                          prediction={area}
                          first={index === 0}
                          selected={selected}
                          onPress={() => onPickPrediction(area)}
                        />
                      )
                    })}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={[ui.sectionLabel, styles.sectionLabel, styles.sectionLabelFirst]}>
                  Suggested areas
                </Text>
                {placesLoading ? (
                  <RowsSkeleton label="Finding places" />
                ) : predictions.length === 0 ? (
                  <View style={styles.empty}>
                    <View style={styles.emptyCircle}>
                      <GradientFill colors={pastels.sky.gradient} angle={150} />
                      <Icon name="search-outline" size={28} color={pastels.sky.ink} />
                    </View>
                    <Text style={styles.emptyTitle}>No places found</Text>
                    <Text style={styles.emptyBody}>Try another area or landmark.</Text>
                  </View>
                ) : (
                  <View style={styles.card}>
                    {predictions.map((prediction, index) => (
                      <PlaceRow
                        key={prediction.placeId}
                        prediction={prediction}
                        first={index === 0}
                        secondaryLines={2}
                        onPress={() => onPickPrediction(prediction)}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

function PlaceRow({
  prediction,
  first,
  selected = false,
  secondaryLines = 1,
  onPress,
}: {
  prediction: PlacePrediction
  first: boolean
  selected?: boolean
  secondaryLines?: number
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[prediction.primaryText, prediction.secondaryText].filter(Boolean).join(", ")}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.row, pressed && ui.pressed]}
      onPress={onPress}
    >
      {!first ? <View style={styles.hairline} /> : null}
      <PastelIcon pastel={pastels.sky} name="location-outline" />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {prediction.primaryText}
        </Text>
        {prediction.secondaryText ? (
          <Text style={styles.rowSub} numberOfLines={secondaryLines}>
            {prediction.secondaryText}
          </Text>
        ) : null}
      </View>
      {selected ? <Icon name="checkmark-circle" size={20} color={sp.text} /> : null}
    </Pressable>
  )
}

function RowsSkeleton({ label }: { label: string }) {
  return (
    <View style={styles.card} accessibilityLabel={label} accessible>
      {[0, 1, 2].map((key) => (
        <View key={key} style={styles.row}>
          {key > 0 ? <View style={styles.hairline} /> : null}
          <SkeletonBone width={36} height={36} radius={10} />
          <View style={[styles.rowText, styles.skelText]}>
            <SkeletonBone width="55%" height={14} />
            <SkeletonBone width="80%" height={12} />
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheet: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    zIndex: 1,
  },
  sheetPulledUp: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  top: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  handleHit: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#d9d2cd",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: sp.text,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  searchField: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#fafafa",
  },
  searchFieldFocused: {
    borderColor: sp.text,
    backgroundColor: "#ffffff",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 46,
    paddingVertical: 0,
    fontSize: 16,
    fontFamily: fontFamily.regular,
    color: sp.text,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: spacing.xl,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: sp.peachBg,
  },
  errorText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: sp.peachInk,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  nearMe: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  spinnerBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: sp.peachBg,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionLabelFirst: {
    marginTop: 8,
  },
  hintCard: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: 62,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: sp.border,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  skelText: {
    gap: 6,
  },
  rowTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: sp.text,
  },
  rowSub: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: sp.secondary,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 22,
    color: sp.text,
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.secondary,
    textAlign: "center",
  },
})
