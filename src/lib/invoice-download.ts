import { File, Paths } from "expo-file-system"
import * as Linking from "expo-linking"
import * as Sharing from "expo-sharing"

import { downloadBookingInvoicePdf } from "@/lib/bookings-api"

function safeInvoiceFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  if (!cleaned) return "invoice.pdf"
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`
}

export async function downloadAndShareInvoice(bookingId: string) {
  const { bytes, fileName } = await downloadBookingInvoicePdf(bookingId)
  const destination = new File(Paths.cache, safeInvoiceFileName(fileName))
  destination.create({ overwrite: true })
  destination.write(bytes)

  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(destination.uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Download invoice",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : ""
      if (message.includes("cancel") || message.includes("dismiss")) return
      throw error
    }
    return
  }

  const opened = await Linking.canOpenURL(destination.uri)
  if (!opened) {
    throw new Error("Could not open the invoice. Please try again.")
  }
  await Linking.openURL(destination.uri)
}
