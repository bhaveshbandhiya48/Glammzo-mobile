import { useState } from "react"
import { StyleSheet, View } from "react-native"

import type { AppOffer } from "@/lib/app-offers-api"

import { AppOfferDetailsSheet } from "./AppOfferDetailsSheet"
import { AppOfferTicket } from "./AppOfferTicket"

type Props = {
  offers: AppOffer[]
  /** Opens the services list from the details sheet. */
  onBook?: () => void
}

/** Glammzo offers that work at this salon or artist, as tickets with a details sheet. */
export function AppOffersOnPage({ offers, onBook }: Props) {
  const [open, setOpen] = useState<AppOffer | null>(null)
  if (offers.length === 0) return null
  return (
    <View style={styles.list}>
      {offers.slice(0, 3).map((offer) => (
        <AppOfferTicket key={offer.id} offer={offer} onPress={() => setOpen(offer)} />
      ))}
      <AppOfferDetailsSheet
        offer={open}
        onClose={() => setOpen(null)}
        ctaLabel={onBook ? "Book a service" : undefined}
        onPressCta={onBook}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
})
