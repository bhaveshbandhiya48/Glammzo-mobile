import { StyleSheet, View } from "react-native"
import { Tabs } from "expo-router"

import { FloatingTabBar } from "@/components/ui/FloatingTabBar"
import {
  BookingsTabIcon,
  HomeTabIcon,
  ProfileTabIcon,
} from "@/components/ui/TabIcons"
import { colors } from "@/theme/tokens"

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{
          title: "Home",
          tabBarAccessibilityLabel: "Home",
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <HomeTabIcon color={color} focused={focused} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarAccessibilityLabel: "Bookings",
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <BookingsTabIcon color={color} focused={focused} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarAccessibilityLabel: "Profile",
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <ProfileTabIcon color={color} focused={focused} size={22} />
            </View>
          ),
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
