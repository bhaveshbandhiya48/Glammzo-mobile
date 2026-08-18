import { useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { PlacePrediction } from "@/lib/location-api"
import { colors, radii, spacing, typography } from "@/theme/tokens"

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
}

const WINDOW_HEIGHT = Dimensions.get("window").height
const COLLAPSED_HEIGHT = Math.min(WINDOW_HEIGHT * 0.58, 500)
const TOP_MARGIN = WINDOW_HEIGHT * 0.2

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
}: Props) {
  const insets = useSafeAreaInsets()
  const inputRef = useRef<TextInput>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    if (!visible) {
      setSearchFocused(false)
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

  function handleClose() {
    Keyboard.dismiss()
    setSearchFocused(false)
    onClose()
  }

  const typing = query.trim().length > 0
  // Pull up as soon as the field is focused — don't wait for keyboard hide.
  const pulledUp = searchFocused || typing

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
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
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View
          style={[
            styles.sheet,
            pulledUp
              ? styles.sheetPulledUp
              : {
                  height: COLLAPSED_HEIGHT,
                  paddingBottom: Math.max(insets.bottom, spacing.lg),
                },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text variant="heading" style={styles.title}>
              Select location
            </Text>
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.iconBtn}
            >
              <Icon name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.searchField}>
            <Icon name="search-outline" size={18} color={colors.textSubtle} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={onQueryChange}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => {
                setTimeout(() => {
                  if ((query || "").trim().length === 0) {
                    setSearchFocused(false)
                  }
                }, 180)
              }}
              placeholder="Search area, street, landmark…"
              placeholderTextColor={colors.textSubtle}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="words"
              clearButtonMode="never"
              accessibilityLabel="Search location"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => {
                  onQueryChange("")
                  inputRef.current?.focus()
                }}
                hitSlop={8}
                accessibilityLabel="Clear search"
              >
                <Icon name="close-circle" size={18} color={colors.textSubtle} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces
            nestedScrollEnabled
          >
            {placesError ? (
              <Text variant="caption" color={colors.destructive} style={styles.error}>
                {placesError}
              </Text>
            ) : null}

            {!typing ? (
              <>
                <Pressable
                  style={[styles.nearMe, nearMeLoading && styles.nearMeDisabled]}
                  onPress={() => {
                    if (!nearMeLoading) onUseCurrentLocation()
                  }}
                  disabled={nearMeLoading}
                >
                  {nearMeLoading ? (
                    <ActivityIndicator color={colors.coral} />
                  ) : (
                    <View style={styles.nearMeIcon}>
                      <Icon name="navigate" size={18} color={colors.coral} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" color={colors.coral}>
                      Use current location
                    </Text>
                    <Text variant="caption" muted>
                      Using GPS for precise area
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.divider} />

                <Text variant="label" muted style={styles.sectionLabel}>
                  Nearby areas
                </Text>
                {nearbyLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.coral} />
                    <Text muted>Finding nearby areas…</Text>
                  </View>
                ) : null}
                {!nearbyLoading && nearbyAreas.length === 0 ? (
                  <Text muted style={styles.emptyHint}>
                    No nearby areas yet. Search for a place above.
                  </Text>
                ) : (
                  nearbyAreas.slice(0, 3).map((area) => {
                    const selected =
                      currentLabel === area.primaryText ||
                      currentLabel.startsWith(`${area.primaryText},`)
                    return (
                      <Pressable
                        key={area.placeId || area.primaryText}
                        style={({ pressed }) => [
                          styles.resultRow,
                          pressed && styles.rowPressed,
                        ]}
                        onPress={() => onPickPrediction(area)}
                      >
                        <View style={styles.resultIcon}>
                          <Icon
                            name="location-outline"
                            size={18}
                            color={colors.textMuted}
                          />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1}>{area.primaryText}</Text>
                          {area.secondaryText ? (
                            <Text variant="caption" muted numberOfLines={1}>
                              {area.secondaryText}
                            </Text>
                          ) : null}
                        </View>
                        {selected ? (
                          <Icon name="checkmark" size={18} color={colors.coral} />
                        ) : null}
                      </Pressable>
                    )
                  })
                )}
              </>
            ) : (
              <>
                <Text variant="label" muted style={styles.sectionLabel}>
                  Suggested areas
                </Text>
                {placesLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.coral} />
                    <Text muted>Finding places…</Text>
                  </View>
                ) : null}
                {!placesLoading && predictions.length === 0 ? (
                  <Text muted style={styles.emptyHint}>
                    No places found. Try another area or landmark.
                  </Text>
                ) : (
                  predictions.map((prediction) => (
                    <Pressable
                      key={prediction.placeId}
                      style={({ pressed }) => [
                        styles.resultRow,
                        pressed && styles.rowPressed,
                      ]}
                      onPress={() => onPickPrediction(prediction)}
                    >
                      <View style={styles.resultIcon}>
                        <Icon
                          name="location-outline"
                          size={18}
                          color={colors.textMuted}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1}>{prediction.primaryText}</Text>
                        {prediction.secondaryText ? (
                          <Text variant="caption" muted numberOfLines={2}>
                            {prediction.secondaryText}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    width: "100%",
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    zIndex: 1,
  },
  sheetPulledUp: {
    flex: 1,
    paddingBottom: spacing.md,
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
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  title: {
    flex: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  searchField: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  error: {
    marginBottom: spacing.sm,
  },
  nearMe: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  nearMeDisabled: {
    opacity: 0.7,
  },
  nearMeIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7F5",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  sectionLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  emptyHint: {
    paddingVertical: spacing.md,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    opacity: 0.72,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
})
