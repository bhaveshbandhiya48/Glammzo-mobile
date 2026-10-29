import { Pressable, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useCart } from "@/context/CartContext"
import { useNotifications } from "@/context/NotificationsContext"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  username: string | null
  locationLabel: string
  searchQuery: string
  onSearchPress: () => void
  onClearSearch?: () => void
  onLocationChangePress?: () => void
  onCartPress?: () => void
  onNotificationsPress?: () => void
}

export function TopChrome({
  username,
  locationLabel,
  searchQuery,
  onSearchPress,
  onClearSearch,
  onLocationChangePress,
  onCartPress,
  onNotificationsPress,
}: Props) {
  const insets = useSafeAreaInsets()
  const { totalItems } = useCart()
  const { unreadCount } = useNotifications()
  const hasQuery = searchQuery.trim().length > 0

  const firstName = username?.trim().split(/\s+/)[0] ?? ""
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <View style={styles.locationBlock}>
          <Text variant="caption" muted>
            {greeting}
          </Text>
          <Text variant="title" numberOfLines={1} style={styles.greeting}>
            {firstName || "Welcome to Glammzo"}
          </Text>
          <Pressable
            onPress={onLocationChangePress}
            hitSlop={8}
            style={({ pressed }) => [styles.locationLine, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Location: ${locationLabel}. Change location`}
          >
            <Icon name="location-outline" size={15} color={colors.textMuted} />
            <Text variant="caption" muted numberOfLines={1} style={styles.locationText}>
              {locationLabel}
            </Text>
            <Icon name="chevron-down" size={14} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onNotificationsPress}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressedBtn]}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          >
            <Icon name="notifications-outline" size={21} color={colors.text} />
            {unreadCount > 0 ? <View style={styles.dot} /> : null}
          </Pressable>

          <Pressable
            onPress={onCartPress}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressedBtn]}
            accessibilityRole="button"
            accessibilityLabel={totalItems > 0 ? `Bag, ${totalItems} items` : "Bag"}
          >
            <Icon name="bag-handle-outline" size={21} color={colors.text} />
            {totalItems > 0 ? (
              <View style={styles.badge}>
                <Text variant="caption" color={colors.primaryFg} style={styles.badgeText}>
                  {totalItems > 9 ? "9+" : totalItems}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <View style={styles.search}>
        <Pressable
          onPress={onSearchPress}
          style={({ pressed }) => [styles.searchHit, pressed && styles.pressed]}
          accessibilityRole="search"
          accessibilityLabel="Search salons, artists and services"
        >
          <Icon name="search-outline" size={19} color={colors.text} />
          <Text
            variant="body"
            color={hasQuery ? colors.text : colors.textSubtle}
            numberOfLines={1}
            style={styles.searchText}
          >
            {hasQuery ? searchQuery.trim() : "Haircut, facial, bridal makeup…"}
          </Text>
        </Pressable>
        {hasQuery && onClearSearch ? (
          <Pressable
            onPress={onClearSearch}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Icon name="close-circle" size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
    gap: spacing.lg,
    zIndex: 30,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  locationBlock: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    fontSize: 24,
    letterSpacing: -0.6,
  },
  locationLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    minHeight: 24,
  },
  locationText: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pressedBtn: {
    backgroundColor: colors.muted,
  },
  dot: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchHit: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
  },
  searchText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
})
