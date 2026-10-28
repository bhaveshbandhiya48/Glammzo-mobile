import { useCallback, useLayoutEffect } from "react"
import { useFocusEffect, useNavigation, useRouter, type Href } from "expo-router"
import { Pressable, StyleSheet, View } from "react-native"

import { ProfileStackHeader } from "@/components/layout/ProfileStackHeader"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Screen } from "@/components/ui/Screen"
import { BookingsListSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { useNotifications } from "@/context/NotificationsContext"
import {
  formatNotificationTime,
  notificationAccent,
  notificationIcon,
} from "@/lib/notifications-display"
import { colors, radii, spacing } from "@/theme/tokens"

export default function NotificationsScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const {
    notifications,
    loading,
    signedIn,
    refresh,
    markRead,
    clearAll,
  } = useNotifications()

  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh]),
  )

  useLayoutEffect(() => {
    navigation.setOptions({
      header: () => (
        <ProfileStackHeader
          title="Notifications"
          right={
            notifications.length > 0 ? (
              <Pressable
                onPress={clearAll}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear all notifications"
                style={({ pressed }) => [
                  styles.clearHit,
                  pressed && styles.clearPressed,
                ]}
              >
                <Text variant="caption" color={colors.coral}>
                  Clear all
                </Text>
              </Pressable>
            ) : undefined
          }
        />
      ),
    })
  }, [navigation, notifications.length, clearAll])

  const showEmptyLayout =
    !loading && (!signedIn || notifications.length === 0)

  return (
    <Screen
      scroll={!showEmptyLayout}
      contentStyle={showEmptyLayout ? styles.emptyScreen : undefined}
    >
      {loading && notifications.length === 0 ? (
        <View style={styles.list}>
          <BookingsListSkeleton count={4} />
        </View>
      ) : !signedIn ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="log-in-outline" size={32} color={colors.coral} />
          </View>
          <Text variant="bodyStrong" style={styles.emptyTitle}>
            Sign in to see updates
          </Text>
          <Text muted style={styles.emptyBody}>
            Confirmations, reminders, cancellations, and cashback show up after you
            sign in.
          </Text>
          <Button
            label="Sign in"
            onPress={() =>
              router.push({ pathname: "/login", params: { next: "/notifications" } })
            }
            style={{ marginTop: spacing.sm }}
          />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="notifications-outline" size={32} color={colors.coral} />
          </View>
          <Text variant="bodyStrong" style={styles.emptyTitle}>
            You&apos;re all caught up
          </Text>
          <Text muted style={styles.emptyBody}>
            Booking confirmations, reminders, cancellations, and wallet credits will
            show here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {notifications.map((item) => {
            const accent = notificationAccent(item.type)
            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.card,
                  !item.read && styles.cardUnread,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  markRead(item.id)
                  if (item.href) {
                    router.push(item.href as Href)
                  }
                }}
              >
                <View style={[styles.iconWrap, { backgroundColor: `${accent}18` }]}>
                  <Icon name={notificationIcon(item.type)} size={20} color={accent} />
                </View>
                <View style={styles.copy}>
                  <View style={styles.titleRow}>
                    <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {!item.read ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text muted numberOfLines={3}>
                    {item.body}
                  </Text>
                  <Text variant="caption" muted style={styles.time}>
                    {formatNotificationTime(item.createdAt)}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  clearHit: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: "center",
  },
  clearPressed: {
    opacity: 0.5,
  },
  list: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  card: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cardUnread: {
    backgroundColor: "#FFF7F5",
    borderColor: "#F8C9C1",
  },
  pressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
  },
  time: {
    marginTop: 4,
  },
  emptyScreen: {
    flex: 1,
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: "#FFF7F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptyBody: {
    textAlign: "center",
    maxWidth: 280,
  },
})

