import { Redirect, Stack, useLocalSearchParams } from "expo-router"

import { isBusinessType } from "@/data/business-types"
import { salonsSeeAllParams } from "@/lib/see-all-params"

/**
 * Legacy business-type page (/category/<type>, used by old offer banners and ?category= links):
 * opens "Salons near you" filtered to that type, nearest first like the old page.
 */
export default function CategoryRedirect() {
  const { type } = useLocalSearchParams<{ type?: string }>()
  const category = typeof type === "string" && isBusinessType(type) ? type : null
  const params = salonsSeeAllParams({
    filters: category ? { category, sort: "nearest" } : {},
  })
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Redirect href={{ pathname: "/salons", params }} />
    </>
  )
}
