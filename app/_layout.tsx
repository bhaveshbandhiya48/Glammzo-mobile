import { useFonts } from "expo-font"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"

import { AnimatedSplash } from "@/components/brand/AnimatedSplash"
import { OfflineBanner } from "@/components/layout/OfflineBanner"
import { ProfileStackHeader } from "@/components/layout/ProfileStackHeader"
import { CartProvider } from "@/context/CartContext"
import { ArtistFavoritesProvider } from "@/context/ArtistFavoritesContext"
import { FavoritesProvider } from "@/context/FavoritesContext"
import { NetworkProvider } from "@/context/NetworkContext"
import { NotificationsProvider } from "@/context/NotificationsContext"
import { useLaunchPermissions } from "@/hooks/useLaunchPermissions"
import { usePushRegistration } from "@/hooks/usePushRegistration"
import "@/lib/config"
import { hydrateGreetingCache } from "@/lib/user"
import { appFonts } from "@/theme/fonts"
import { colors } from "@/theme/tokens"

/** Resolves true only when native splash was successfully locked for this VC. */
const nativeSplashLock = SplashScreen.preventAutoHideAsync()
  .then((prevented) => {
    if (!prevented) return false
    // Instant handoff to the video splash — no native fade.
    SplashScreen.setOptions({
      duration: 0,
      fade: false,
    })
    return true
  })
  .catch(() => false)

async function hideNativeSplash() {
  const locked = await nativeSplashLock
  if (!locked) return
  try {
    SplashScreen.hide()
  } catch {
    // Already hidden / Fast Refresh / no splash registered for this VC.
  }
}

const profileStackOptions = (title: string) => ({
  title,
  headerShadowVisible: false,
  header: () => <ProfileStackHeader title={title} />,
})

function RootNavigator() {
  useLaunchPermissions()
  usePushRegistration()

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: true,
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          headerTitleStyle: {
            fontFamily: "Sora_600SemiBold",
            fontSize: 17,
          },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="salon/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="book/[salonId]" options={{ title: "Booking" }} />
        <Stack.Screen
          name="book/confirmation"
          options={{ title: "Confirmed", headerBackVisible: false }}
        />
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
            presentation: "modal",
          }}
        />
        <Stack.Screen name="services" options={{ title: "Services" }} />
        <Stack.Screen name="category/[type]" options={{ title: "Category" }} />
        <Stack.Screen name="artists/index" options={{ title: "Artists" }} />
        <Stack.Screen name="artist/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="artist/book/[slug]" options={{ title: "Booking" }} />
        <Stack.Screen name="review" options={{ title: "Leave a review", presentation: "modal" }} />
        <Stack.Screen
          name="bookings/[id]/reschedule"
          options={{ title: "Reschedule" }}
        />
        <Stack.Screen
          name="notifications"
          options={profileStackOptions("Notifications")}
        />
        <Stack.Screen name="profile/wallet" options={profileStackOptions("Wallet")} />
        <Stack.Screen
          name="profile/loyalty"
          options={profileStackOptions("Loyalty rewards")}
        />
        <Stack.Screen
          name="profile/activity"
          options={profileStackOptions("Wallet activity")}
        />
        <Stack.Screen
          name="profile/details"
          options={profileStackOptions("Profile information")}
        />
        <Stack.Screen
          name="profile/favorites"
          options={profileStackOptions("Saved")}
        />
        <Stack.Screen
          name="profile/support"
          options={profileStackOptions("Help & support")}
        />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(appFonts)
  const [splashDone, setSplashDone] = useState(false)
  const onSplashFinish = useCallback(() => setSplashDone(true), [])

  useEffect(() => {
    // Native splash is blank cream — hide only if we locked it, then show splash.mp4.
    void hideNativeSplash()
    void hydrateGreetingCache()
  }, [])

  const showApp = fontsLoaded && splashDone

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {showApp ? (
        <CartProvider>
          <FavoritesProvider>
            <ArtistFavoritesProvider>
              <NotificationsProvider>
                <NetworkProvider>
                  <View style={{ flex: 1 }}>
                    <RootNavigator />
                    <OfflineBanner />
                  </View>
                </NetworkProvider>
              </NotificationsProvider>
            </ArtistFavoritesProvider>
          </FavoritesProvider>
        </CartProvider>
      ) : null}
      {!splashDone ? <AnimatedSplash onFinish={onSplashFinish} /> : null}
    </View>
  )
}
