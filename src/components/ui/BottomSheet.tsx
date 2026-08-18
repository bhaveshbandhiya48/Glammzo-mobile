import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
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
}

const WINDOW_HEIGHT = Dimensions.get("window").height

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
  searchMode = false,
  scroll = true,
  compact = false,
}: Props) {
  const insets = useSafeAreaInsets()
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const dragY = useRef(new Animated.Value(0)).current

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

  useEffect(() => {
    if (!visible) {
      dragY.setValue(0)
    }
  }, [dragY, visible])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_event, gesture) => {
          dragY.setValue(Math.max(0, gesture.dy))
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 90 || gesture.vy > 1.1) {
            Animated.timing(dragY, {
              toValue: Math.max(gesture.dy, 180),
              duration: 140,
              useNativeDriver: true,
            }).start(() => {
              dragY.setValue(0)
              onClose()
            })
            return
          }
          Animated.spring(dragY, {
            toValue: 0,
            bounciness: 0,
            useNativeDriver: true,
          }).start()
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragY, {
            toValue: 0,
            bounciness: 0,
            useNativeDriver: true,
          }).start()
        },
      }),
    [dragY, onClose],
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: sheetMaxHeight,
              height: fillHeight ? sheetMaxHeight : undefined,
              paddingBottom: bottomPad,
              transform: [{ translateY: dragY }],
            },
          ]}
        >
          <View {...panResponder.panHandlers}>
            <View style={styles.handle} />

            {!searchMode ? (
              <View style={styles.header}>
                <Text variant="heading" style={styles.title}>
                  {title}
                </Text>
                <CloseButton onPress={onClose} />
              </View>
            ) : null}

            {/* Stable slot — keep search mounted so focus isn’t lost when title collapses. */}
            {stickyHeader ? (
              <View style={[styles.stickyHeader, searchMode && styles.searchTopBar]}>
                <View style={searchMode ? styles.searchTopBarField : undefined}>
                  {stickyHeader}
                </View>
                {searchMode ? <CloseButton onPress={onClose} /> : null}
              </View>
            ) : null}
          </View>

          {scroll ? (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              bounces
              nestedScrollEnabled
            >
              {children}
            </ScrollView>
          ) : (
            <View style={compact ? styles.compactBody : styles.fillBody}>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.sand,
    marginBottom: spacing.md,
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
