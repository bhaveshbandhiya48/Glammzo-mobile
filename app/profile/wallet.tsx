import { Redirect, Stack } from "expo-router"

/** Wallet now lives in Profile → Activity. Old links (notifications, login `next`) still land there. */
export default function WalletRedirect() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Redirect href="/profile/activity" />
    </>
  )
}
