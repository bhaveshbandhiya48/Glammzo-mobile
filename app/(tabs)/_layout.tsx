import { Platform, StyleSheet, Text, View } from "react-native"
import { Tabs } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  BookingsTabIcon,
  HomeTabIcon,
  ProfileTabIcon,
} from "@/components/ui/TabIcons"
import { colors } from "@/theme/tokens"

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 10,
        letterSpacing: 0.2,
        fontFamily: focused ? "Geist_600SemiBold" : "Geist_500Medium",
        color: focused ? colors.primary : colors.textSubtle,
        marginTop: 4,
      }}
    >
      {label}
    </Text>
  )
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const bottomPad = Math.max(insets.bottom, 8)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: "rgba(228, 222, 210, 0.9)",
          height: 58 + bottomPad,
          paddingTop: 10,
          paddingBottom: bottomPad,
          ...(Platform.OS === "ios"
            ? {
                shadowColor: "#000",
                shadowOpacity: 0.04,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: -4 },
              }
            : { elevation: 6 }),
        },
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{
          title: "Home",
          tabBarAccessibilityLabel: "Home",
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <HomeTabIcon color={color} focused={focused} size={24} />
            </View>
          ),
          tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarAccessibilityLabel: "Bookings",
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <BookingsTabIcon color={color} focused={focused} size={24} />
            </View>
          ),
          tabBarLabel: ({ focused }) => <TabLabel label="Bookings" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarAccessibilityLabel: "Profile",
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <ProfileTabIcon color={color} focused={focused} size={24} />
            </View>
          ),
          tabBarLabel: ({ focused }) => <TabLabel label="Profile" focused={focused} />,
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
  },
})
