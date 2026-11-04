import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
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
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useSheetAnimation } from "@/components/ui/useSheetAnimation"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  visible: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** Pinned above the scroll body (e.g. search). Stays visible with the keyboard. */
  stickyHeader?: ReactNode
  /** Pinned below the body (e.g. Apply / Clear). */
  footer?: ReactNode
  /** Grow toward nearly full height (useful while searching). */
  expanded?: boolean
  /** Collapse the title so stickyHeader becomes the top bar. */
  searchMode?: boolean
  /** When false, children fill remaining height (no outer ScrollView). */
  scroll?: boolean
  /** Size to content instead of stretching toward full screen height. */
  compact?: boolean
  /** Remount scroll body when this changes (e.g. details → cancel form). */
  contentKey?: string | number
  /** False while the sheet must stay open (e.g. a payment is starting): no close button, swipe or backdrop. */
  dismissible?: boolean
  /** Ask first: closing gestures call this and the sheet stays open until the parent closes it. */
  confirmClose?: () => void
}

const WINDOW_HEIGHT = Dimensions.get("window").height
const DISMISS_DISTANCE = 72
const DISMISS_VELOCITY = 0.55

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Close"
      style={styles.closeBtn}
    >
      <Icon name="close" size={22} color={colors.text} />
    </Pressable>
  )
}

export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  stickyHeader,
  footer,
  expanded = false,
  dismissible = true,
  confirmClose,
  searchMode = false,
  scroll = true,
  compact = false,
  contentKey,
}: Props) {
  const insets = useSafeAreaInsets()
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const dragY = useRef(new Animated.Value(0)).current
  const scrollOffsetRef = useRef(0)
  const closingRef = useRef(false)
  const { mounted, backdropOpacity, sheetY, markDragDismissed } = useSheetAnimation(visible)

  const dragFade = useMemo(
    () =>
      dragY.interpolate({
        inputRange: [0, WINDOW_HEIGHT * 0.4],
        outputRange: [1, 0],
        extrapolate: "clamp",
      }),
    [dragY],
  )
  const combinedBackdropOpacity = useMemo(
    () => Animated.multiply(backdropOpacity, dragFade),
    [backdropOpacity, dragFade],
  )

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0)
      return
    }

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
  }, [visible])

  const keyboardOpen = keyboardHeight > 0
  const topGap = keyboardOpen ? spacing.sm : spacing.md
  const fraction = expanded || searchMode || keyboardOpen || !scroll ? 0.94 : 0.88
  const sheetMaxHeight = Math.max(
    280,
    Math.min(WINDOW_HEIGHT * fraction, WINDOW_HEIGHT - keyboardHeight - topGap),
  )
  const bottomPad = keyboardOpen
    ? spacing.md
    : Math.max(insets.bottom, spacing.lg)
  const fillHeight =
    !compact &&
    (expanded || searchMode || keyboardOpen || Boolean(footer) || !scroll)

  // Reset drag only when opening or after the modal unmounts — never mid-dismiss.
  useEffect(() => {
    if (visible) {
      closingRef.current = false
      scrollOffsetRef.current = 0
      dragY.setValue(0)
    }
  }, [dragY, visible])

  useEffect(() => {
    scrollOffsetRef.current = 0
  }, [contentKey])

  useEffect(() => {
    if (!mounted) {
      closingRef.current = false
      scrollOffsetRef.current = 0
      dragY.setValue(0)
    }
  }, [dragY, mounted])

  const dismissibleRef = useRef(dismissible)
  dismissibleRef.current = dismissible
  const confirmCloseRef = useRef(confirmClose)
  confirmCloseRef.current = confirmClose

  function finishClose() {
    if (!dismissibleRef.current || closingRef.current) return
    if (confirmCloseRef.current) {
      confirmCloseRef.current()
      return
    }
    closingRef.current = true
    onClose()
  }

  function snapBack() {
    if (closingRef.current) return
    Animated.spring(dragY, {
      toValue: 0,
      damping: 28,
      stiffness: 320,
      mass: 0.85,
      useNativeDriver: true,
    }).start()
  }

  function dismissWithDrag(currentY: number) {
    if (closingRef.current) return
    closingRef.current = true

    Animated.parallel([
      Animated.timing(dragY, {
        toValue: Math.max(currentY, WINDOW_HEIGHT),
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        closingRef.current = false
        return
      }
      // Sheet is already off-screen — skip the exit slide so it doesn't snap back up.
      markDragDismissed()
      onClose()
    })
  }

  function shouldDismiss(gesture: { dy: number; vy: number }) {
    const wantsClose = dismissibleRef.current && (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY)
    if (wantsClose && confirmCloseRef.current) {
      confirmCloseRef.current()
      return false
    }
    return wantsClose
  }

  function isPullDown(gesture: { dy: number; dx: number }) {
    return gesture.dy > 0 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.15
  }

  // Drag from the handle — capture immediately so the sheet feels swipeable.
  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !keyboardOpen && !closingRef.current,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !keyboardOpen &&
          !closingRef.current &&
          gesture.dy > 3 &&
          isPullDown(gesture),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_event, gesture) => {
          if (closingRef.current) return
          dragY.setValue(Math.max(0, gesture.dy))
        },
        onPanResponderRelease: (_event, gesture) => {
          if (closingRef.current) return
          if (shouldDismiss(gesture)) {
            dismissWithDrag(gesture.dy)
            return
          }
          snapBack()
        },
        onPanResponderTerminate: snapBack,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragY, keyboardOpen, backdropOpacity, markDragDismissed, onClose],
  )

  // Chrome-only drag (handle/title). Body stays free for buttons and scroll.
  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => {
          if (keyboardOpen || closingRef.current) return false
          return isPullDown(gesture) && gesture.dy > 6
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderMove: (_event, gesture) => {
          if (closingRef.current) return
          dragY.setValue(Math.max(0, gesture.dy))
        },
        onPanResponderRelease: (_event, gesture) => {
          if (closingRef.current) return
          if (shouldDismiss(gesture)) {
            dismissWithDrag(gesture.dy)
            return
          }
          snapBack()
        },
        onPanResponderTerminate: snapBack,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragY, keyboardOpen, backdropOpacity, markDragDismissed, onClose, scroll],
  )

  function onBodyScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y)
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={finishClose}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: combinedBackdropOpacity }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={StyleSheet.absoluteFill}
            onPress={finishClose}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: sheetMaxHeight,
              height: fillHeight ? sheetMaxHeight : undefined,
              paddingBottom: bottomPad,
              transform: [{ translateY: Animated.add(sheetY, dragY) }],
            },
          ]}
        >
          {/* Drag only on chrome — keep body taps (Cancel, etc.) free of pan capture. */}
          <View style={styles.chrome} {...sheetPanResponder.panHandlers}>
            <View style={styles.handleHit} {...handlePanResponder.panHandlers}>
              <View style={styles.handle} />
            </View>

            {!searchMode ? (
              <View style={styles.header}>
                <Text variant="heading" style={styles.title}>
                  {title}
                </Text>
                {dismissible ? <CloseButton onPress={finishClose} /> : null}
              </View>
            ) : null}

            {/* Stable slot — keep search mounted so focus isn’t lost when title collapses. */}
            {stickyHeader ? (
              <View style={[styles.stickyHeader, searchMode && styles.searchTopBar]}>
                <View style={searchMode ? styles.searchTopBarField : undefined}>
                  {stickyHeader}
                </View>
                {searchMode ? <CloseButton onPress={finishClose} /> : null}
              </View>
            ) : null}
          </View>

          {scroll ? (
            <ScrollView
              key={contentKey ?? "sheet-body"}
              style={styles.body}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              bounces
              nestedScrollEnabled
              scrollEventThrottle={16}
              onScroll={onBodyScroll}
              onScrollBeginDrag={onBodyScroll}
              onScrollEndDrag={onBodyScroll}
              onMomentumScrollEnd={onBodyScroll}
            >
              {children}
            </ScrollView>
          ) : (
            <View
              key={contentKey ?? "sheet-body"}
              style={compact ? styles.compactBody : styles.fillBody}
            >
              {children}
            </View>
          )}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  chrome: {
    paddingBottom: spacing.xs,
  },
  handleHit: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.sand,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  title: {
    flex: 1,
  },
  stickyHeader: {
    marginBottom: spacing.md,
  },
  searchTopBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchTopBarField: {
    flex: 1,
    minWidth: 0,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  fillBody: {
    flex: 1,
    minHeight: 0,
  },
  compactBody: {
    flexGrow: 0,
  },
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
})
