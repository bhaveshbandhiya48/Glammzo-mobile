import { useState } from "react"
import { Alert, Share } from "react-native"

import { Button } from "@/components/ui/Button"
import type { Booking } from "@/data/types"
import { buildArtistInvoiceMessage } from "@/lib/artist-invoice"

type Props = {
  booking: Booking
}

/** Share a plain-text booking invoice via WhatsApp / system share sheet. */
export function ShareArtistInvoiceButton({ booking }: Props) {
  const [busy, setBusy] = useState(false)

  return (
    <Button
      label="Share invoice on WhatsApp"
      variant="secondary"
      loading={busy}
      onPress={() => {
        void (async () => {
          setBusy(true)
          try {
            await Share.share({
              message: buildArtistInvoiceMessage(booking),
            })
          } catch {
            Alert.alert(
              "Couldn't share",
              "Could not open the share sheet. Please try again.",
            )
          } finally {
            setBusy(false)
          }
        })()
      }}
    />
  )
}
