import { useCallback, useLayoutEffect, useMemo } from "react"
import { useFocusEffect, useNavigation, useRouter, type Href } from "expo-router"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ActionPill } from "@/components/bookings/BookingPills"
import { GradientFill } from "@/components/home/GradientFill"
import { PastelIcon, type Pastel } from "@/components/profile/ProfileParts"
import { pastels, sp, ui } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { SkeletonBone } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { useNotifications, type AppNotificationType } from "@/context/NotificationsContext"
import { formatNotificationTime, notificationGroup } from "@/lib/notifications-display"
import { fontFamily } from "@/theme/tokens"

const GREY: Pastel = { gradient: ["#f5f5f5", "#e9e9e9"], ink: "#595959" }

/** Pastel square + icon by notification kind. */
function notificationLook(type: AppNotificationType): { pastel: Pastel; icon: IconName } {
  switch (type) {
    case "booking_confirmed":
    case "booking_pending":
    case "booking_rescheduled":
    case "booking_completed":
      return { pastel: pastels.mint, icon: "calendar-outline" }
    case "booking_reminder":
      return { pastel: pastels.lavender, icon: "notifications-outline" }
    case "cashback":
      return { pastel: pastels.peach, icon: "pricetag-outline" }
    case "loyalty":
      return { pastel: pastels.gold, icon: "gift-outline" }
    case "booking_cancelled":
    case "booking_declined":
      return { pastel: GREY, icon: "close-circle-outline" }
    default:
      return { pastel: GREY, icon: "notifications-outline" }
  }
}

export default function NotificationsScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
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

  // This screen draws its own peach header.
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/profile")
  }

  const showEmptyLayout = !loading && (!signedIn || notifications.length === 0)

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
          showEmptyLayout && styles.contentFill,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={6}
              onPress={goBack}
              style={({ pressed }) => [styles.back, pressed && ui.pressed]}
            >
              <Icon name="chevron-back" size={20} color={sp.text} />
            </Pressable>
            <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
              Notifications
            </Text>
            {notifications.length > 0 ? (
              <Pressable
                onPress={clearAll}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear all notifications"
                style={({ pressed }) => [styles.clearHit, pressed && ui.pressed]}
              >
                <Text style={styles.clearText}>Clear all</Text>
              </Pressable>
            ) : null}
          </View>
          {signedIn && unreadCount > 0 ? (
            <View style={styles.summaryRow}>
              <View style={styles.newBadge}>
                <View style={styles.newDot} />
                <Text style={styles.newText}>{unreadCount} new</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark all as read"
                onPress={markAllRead}
                hitSlop={6}
                style={({ pressed }) => [ui.addPill, styles.markAll, pressed && ui.pressed]}
              >
                <Text style={ui.addPillText}>Mark all read</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {loading && notifications.length === 0 ? (
          <NotificationsSkeleton />
        ) : !signedIn ? (
          <EmptyState
            icon="log-in-outline"
            pastel={pastels.lavender}
            title="Sign in to see updates"
            body="Confirmations, reminders, cancellations, and cashback show up after you sign in."
            actionLabel="Sign in"
            onAction={() =>
              router.push({ pathname: "/login", params: { next: "/notifications" } })
            }
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            pastel={pastels.peach}
            title="You're all caught up"
            body="Booking confirmations, reminders, cancellations, and wallet credits will show here."
          />
        ) : (
          <View style={styles.body}>
            {groups.map((group) => (
              <View key={group.title} style={styles.group}>
                <Text style={[ui.sectionLabel, styles.groupLabel]} accessibilityRole="header">
                  {group.title}
                </Text>
                <View style={styles.card}>
                  {group.items.map((item, index) => {
                    const look = notificationLook(item.type)
                    const time = formatNotificationTime(item.createdAt)
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${item.read ? "" : "New. "}${item.title}. ${item.body} ${time}`}
                        key={item.id}
                        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                        onPress={() => {
                          markRead(item.id)
                          if (item.href) {
                            router.push(item.href as Href)
                          }
                        }}
                      >
                        {index > 0 ? <View style={styles.hairline} /> : null}
                        <PastelIcon pastel={look.pastel} name={look.icon} />
                        <View style={styles.copy}>
                          <View style={styles.titleRow}>
                            <Text
                              style={[styles.itemTitle, !item.read && styles.itemTitleUnread]}
                              numberOfLines={1}
                            >
                              {item.title}
                            </Text>
                            <Text style={styles.time}>{time}</Text>
                            {!item.read ? <View style={styles.unreadDot} /> : null}
                          </View>
                          <Text style={styles.itemBody} numberOfLines={2}>
                            {item.body}
                          </Text>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function EmptyState({
  icon,
  pastel,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: IconName
  pastel: Pastel
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyCircle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <GradientFill colors={pastel.gradient} angle={150} />
        <Icon name={icon} size={36} color={pastel.ink} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {actionLabel && onAction ? (
        <View style={styles.emptyAction}>
          <ActionPill label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  )
}

function NotificationsSkeleton() {
  return (
    <View style={styles.body} accessibilityLabel="Loading notifications" accessible>
      <View style={styles.group}>
        <SkeletonBone width={72} height={12} />
        <View style={[styles.card, styles.skelCard]}>
          {[0, 1, 2, 3].map((key) => (
            <View key={key} style={styles.row}>
              {key > 0 ? <View style={styles.hairline} /> : null}
              <SkeletonBone width={36} height={36} radius={10} />
              <View style={[styles.copy, styles.skelText]}>
                <SkeletonBone width="60%" height={14} />
                <SkeletonBone width="90%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flexGrow: 1,
  },
  contentFill: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
    color: sp.text,
  },
  clearHit: {
    minHeight: 38,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  clearText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: sp.secondary,
  },
  summaryRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  newBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: sp.peachBg,
  },
  newDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: sp.peachInk,
  },
  newText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: sp.peachInk,
  },
  markAll: {
    height: 32,
    borderWidth: 1,
    borderColor: sp.border,
  },
  body: {
    paddingHorizontal: 16,
    gap: 24,
    paddingTop: 4,
  },
  group: {
    gap: 10,
  },
  groupLabel: {
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  skelCard: {
    marginTop: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: "#fafafa",
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: 62,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: sp.border,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  skelText: {
    gap: 8,
    paddingTop: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
    color: sp.text,
  },
  itemTitleUnread: {
    fontFamily: fontFamily.semibold,
  },
  time: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: "#8a8a8a",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: sp.peachInk,
  },
  itemBody: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.secondary,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 64,
  },
  emptyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: sp.text,
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 6,
    maxWidth: 300,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.secondary,
    textAlign: "center",
  },
  emptyAction: {
    marginTop: 20,
  },
})
