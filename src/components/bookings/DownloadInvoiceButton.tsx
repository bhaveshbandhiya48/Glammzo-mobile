import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { downloadAndShareInvoice } from "@/lib/invoice-download"
import { fontFamily } from "@/theme/tokens"

type Props = {
  bookingId: string
}

/** Outline 48 pill with a document icon; shares the PDF invoice. */
export function DownloadInvoiceButton({ bookingId }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setError(null)
    setPending(true)
    try {
      await downloadAndShareInvoice(bookingId)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not download the invoice. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Download invoice"
        accessibilityState={{ busy: pending, disabled: pending }}
        disabled={pending}
        onPress={() => void download()}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        {pending ? (
          <ActivityIndicator color="#111111" />
        ) : (
          <>
            <Icon name="document-text-outline" size={18} color="#111111" />
            <Text style={styles.label}>Download invoice</Text>
          </>
        )}
      </Pressable>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  pill: {
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pressed: {
    backgroundColor: "#f6f6f6",
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: "#111111",
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: "#c0392b",
  },
})
