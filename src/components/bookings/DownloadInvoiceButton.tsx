import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { Button } from "@/components/ui/Button"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { downloadAndShareInvoice } from "@/lib/invoice-download"
import { colors, spacing } from "@/theme/tokens"

type Props = {
  bookingId: string
}

export function DownloadInvoiceButton({ bookingId }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <View style={styles.wrap}>
      <Button
        label="Download invoice"
        variant="secondary"
        loading={pending}
        onPress={async () => {
          setError(null)
          setPending(true)
          try {
            await downloadAndShareInvoice(bookingId)
          } catch (err) {
            setError(
              err instanceof ApiError
                ? err.message
                : "Could not download the invoice. Please try again.",
            )
          } finally {
            setPending(false)
          }
        }}
      />
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
  },
})
