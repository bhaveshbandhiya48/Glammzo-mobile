import { useCallback, useLayoutEffect, useMemo } from "react"
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
  notificationGroup,
  notificationIcon,
  notificationTone,
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
    markAllRead,
    clearAll,
  } = useNotifications()

  const unreadCount = notifications.filter((item) => !item.read).length
  const groups = useMemo(() => {
    const order = ["Today", "Yesterday", "This week", "Earlier"]
    const map = new Map<string, typeof notifications>()
    for (const item of notifications) {
      const key = notificationGroup(item.createdAt)
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return order.filter((title) => map.has(title)).map((title) => ({ title, items: map.get(title)! }))
  }, [notifications])

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
                <Text variant="caption" style={styles.markAllText}>
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
            <Icon name="log-in-outline" size={32} color={colors.primary} />
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
            <Icon name="notifications-outline" size={32} color={colors.primary} />
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
          {unreadCount > 0 ? (
            <View style={styles.summaryRow}>
              <Text variant="caption" muted>
                {unreadCount} new
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={markAllRead}
                hitSlop={8}
                style={styles.markAll}
              >
                <Text variant="caption" style={styles.markAllText}>
                  Mark all as read
                </Text>
              </Pressable>
            </View>
          ) : null}
          {groups.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text variant="label" muted accessibilityRole="header" style={styles.groupTitle}>
                {group.title}
              </Text>
              <View style={styles.groupCard}>
                {group.items.map((item, index) => {
                  const tone = notificationTone(item.type)
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.read ? "" : "New. "}${item.title}. ${item.body} ${formatNotificationTime(item.createdAt)}`}
                      key={item.id}
                      style={({ pressed }) => [
                        styles.row,
                        index > 0 && styles.rowDivider,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => {
                        markRead(item.id)
                        if (item.href) {
                          router.push(item.href as Href)
                        }
                      }}
                    >
                      <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
                        <Icon name={notificationIcon(item.type)} size={20} color={tone.fg} />
                      </View>
                      <View style={styles.copy}>
                        <View style={styles.titleRow}>
                          <Text
                            variant={item.read ? "body" : "bodyStrong"}
                            style={{ flex: 1 }}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text variant="caption" muted>
                            {formatNotificationTime(item.createdAt)}
                          </Text>
                        </View>
                        <Text variant="caption" muted numberOfLines={2} style={styles.body}>
                          {item.body}
                        </Text>
                      </View>
                      {!item.read ? <View style={styles.unreadDot} /> : null}
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ))}
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
    marginTop: spacing.sm,
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  markAll: {
    minHeight: 36,
    justifyContent: "center",
  },
  markAllText: {
    fontFamily: "Geist_600SemiBold",
    color: colors.text,
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    paddingHorizontal: spacing.xs,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 72,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.muted,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  body: {
    lineHeight: 18,
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
    backgroundColor: colors.primary,
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
    backgroundColor: "#F1F1F1",
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

