import { useRouter } from "expo-router"
import { useState } from "react"
import { Linking, StyleSheet, View } from "react-native"

import { Button } from "@/components/ui/Button"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { startPackagePurchase } from "@/lib/packages-api"
import { formatRupees } from "@/lib/service-pricing"
import { getAccessToken } from "@/lib/session"
import { colors, spacing } from "@/theme/tokens"

/** Prepay a package now and book its sessions over 12 months. */
export function BuyAheadButton({ salonId, packageId, price }: { salonId: string; packageId: string; price: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <View style={styles.wrap}>
      <Button
        label={`Buy ahead · ${formatRupees(price)}`}
        variant="secondary"
        loading={busy}
        onPress={async () => {
          setError(null)
          if (!(await getAccessToken())) {
            router.push({ pathname: "/login", params: { next: `/salon/${salonId}` } })
            return
          }
          setBusy(true)
          try {
            await Linking.openURL(await startPackagePurchase(salonId, packageId))
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't start the purchase.")
          } finally {
            setBusy(false)
          }
        }}
      />
      <Text variant="caption" muted>
        Pay now and book each session whenever you like over 12 months. Nothing more to pay for these services at the
        salon. No refunds once paid.
      </Text>
      {error ? (
        <Text variant="caption" color={colors.destructive}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
})
