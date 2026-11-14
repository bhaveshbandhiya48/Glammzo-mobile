import { Redirect, Stack } from "expo-router"

/** Legacy "all services" list: opens "Salons near you", where type, price and rating filters live. */
export default function ServicesRedirect() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Redirect href="/salons" />
    </>
  )
}
