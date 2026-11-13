import { Platform, Pressable, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GradientFill } from "@/components/home/GradientFill"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { useNotifications } from "@/context/NotificationsContext"
import { fontFamily } from "@/theme/tokens"

type Props = {
  username: string | null
  /** Area line (e.g. "Indiranagar"); falls back to the full label. */
  areaLabel: string
  cityLabel?: string | null
  searchQuery: string
  onLocationPress: () => void
  onSearchPress: () => void
  onClearSearch: () => void
  onNotificationsPress: () => void
  onProfilePress: () => void
}

export function HomeHeader({
  username,
  areaLabel,
  cityLabel,
  searchQuery,
  onLocationPress,
  onSearchPress,
  onClearSearch,
  onNotificationsPress,
  onProfilePress,
}: Props) {
  const insets = useSafeAreaInsets()
  const { unreadCount } = useNotifications()
  const firstName = username?.trim().split(/\s+/)[0] ?? ""
  const initial = firstName.charAt(0).toUpperCase()
  const hasQuery = searchQuery.trim().length > 0

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />

      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Location: ${[areaLabel, cityLabel].filter(Boolean).join(", ")}. Change location`}
          onPress={onLocationPress}
          style={({ pressed }) => [styles.locationHit, pressed && styles.pressed]}
        >
          <View style={styles.roundBtn}>
            <Icon name="location-outline" size={19} color="#111111" />
          </View>
          <View style={styles.locationText}>
            <View style={styles.areaRow}>
              <Text style={styles.area} numberOfLines={1}>
                {areaLabel}
              </Text>
              <Icon name="chevron-down" size={14} color="#111111" />
            </View>
            {cityLabel ? (
              <Text style={styles.city} numberOfLines={1}>
                {cityLabel}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            onPress={onNotificationsPress}
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
          >
            <Icon name="notifications-outline" size={19} color="#111111" />
            {unreadCount > 0 ? <View style={styles.dot} /> : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={onProfilePress}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          >
            {initial ? (
              <Text style={styles.avatarText}>{initial}</Text>
            ) : (
              <Icon name="person" size={18} color="#ffffff" />
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.greeting}>
        <Text style={styles.hi} numberOfLines={1}>
          {firstName ? `Hi ${firstName},` : "Hi there,"}
        </Text>
        <Text style={[styles.hi, styles.hiMuted]} numberOfLines={1}>
          what&apos;s the plan today?
        </Text>
      </View>

      <View style={styles.search}>
        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Search salons, artists or services"
          onPress={onSearchPress}
          style={({ pressed }) => [styles.searchHit, pressed && styles.pressed]}
        >
          <Icon name="search-outline" size={19} color="#4b5563" />
          <Text
            style={[styles.searchText, !hasQuery && styles.placeholder]}
            numberOfLines={1}
          >
            {hasQuery ? searchQuery.trim() : "Search salons, artists or services"}
          </Text>
        </Pressable>
        {hasQuery ? (
          <Pressable
            onPress={onClearSearch}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Icon name="close-circle" size={18} color="#595959" />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const softShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  default: { elevation: 2 },
})

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  locationHit: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0e4dd",
    alignItems: "center",
    justifyContent: "center",
  },
  locationText: {
    flex: 1,
    minWidth: 0,
  },
  areaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  area: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    color: "#111111",
  },
  city: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: "#595959",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e5484d",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: "#ffffff",
  },
  greeting: {
    marginTop: 22,
  },
  hi: {
    fontFamily: fontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: "#111111",
  },
  hiMuted: {
    color: "#6b6b6b",
  },
  search: {
    marginTop: 18,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ece6e2",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
    ...softShadow,
  },
  searchHit: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: "#111111",
  },
  placeholder: {
    color: "#595959",
  },
  pressed: {
    opacity: 0.7,
  },
})
