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

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onLocationChangePress}
          style={({ pressed }) => [styles.locationBlock, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Change location"
        >
          <Text variant="caption" muted>
            Book near
          </Text>
          <View style={styles.locationLine}>
            <Icon name="location" size={16} color={colors.primary} />
            <Text variant="bodyStrong" numberOfLines={1} style={styles.locationText}>
              {locationLabel}
            </Text>
            <Icon name="chevron-down" size={16} color={colors.text} />
          </View>
          {username ? (
            <Text variant="caption" muted numberOfLines={1}>
              Hi {username}
            </Text>
          ) : null}
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            onPress={onNotificationsPress}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Icon name="notifications-outline" size={22} color={colors.text} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text variant="caption" color={colors.primaryFg} style={styles.badgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={onCartPress}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Bag"
          >
            <Icon name="bag-handle-outline" size={22} color={colors.text} />
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
          accessibilityLabel="Search salons"
        >
          <Icon name="search-outline" size={18} color={colors.textSubtle} />
          <Text
            variant="body"
            color={hasQuery ? colors.text : colors.textSubtle}
            numberOfLines={1}
            style={styles.searchText}
          >
            {hasQuery ? searchQuery.trim() : "Search salons, spa, barber…"}
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
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
    zIndex: 30,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  locationBlock: {
    flex: 1,
    gap: 2,
  },
  locationLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    flexShrink: 1,
    fontSize: 17,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
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
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchHit: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
  },
  searchText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.88,
  },
})
