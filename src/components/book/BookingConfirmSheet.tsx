import { StyleSheet, View } from "react-native"

import {
  bk,
  Hairline,
  Notice,
  PlaceRow,
  ReceiptRow,
  ReceiptTotal,
} from "@/components/book/BookingUi"
import { PrimaryPill } from "@/components/profile/ProfileScreenParts"
import { ui } from "@/components/salon-page/theme"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

export type BookingConfirmLine = {
  label: string
  value: string
  emphasis?: boolean
  success?: boolean
  muted?: boolean
}

type Props = {
  visible: boolean
  onClose: () => void
  salonName: string
  salonArea: string
  salonImageUrl: string
  serviceLines: { title: string; subtitle: string; priceLabel: string }[]
  dateLabel: string
  timeLabel: string
  staffLabel: string | null
  customerName: string
  customerPhone: string
  customerEmail: string
  notes: string | null
  priceLines: BookingConfirmLine[]
  totalLabel: string
  submitting: boolean
  error: string | null
  onConfirm: () => void
}

function Fact({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factIcon}>
        <Icon name={icon} size={16} color={bk.text} />
      </View>
      <View style={styles.factCopy}>
        <Text style={styles.factTitle}>{title}</Text>
        <Text style={styles.factText} numberOfLines={2}>
          {text}
        </Text>
      </View>
    </View>
  )
}

/** Last look before booking: receipt-style summary and one black pill. */
export function BookingConfirmSheet({
  visible,
  onClose,
  salonName,
  salonArea,
  salonImageUrl,
  serviceLines,
  dateLabel,
  timeLabel,
  staffLabel,
  customerName,
  customerPhone,
  customerEmail,
  notes,
  priceLines,
  totalLabel,
  submitting,
  error,
  onConfirm,
}: Props) {
  return (
    <BottomSheet visible={visible} title="Booking summary" onClose={onClose}>
      <View style={styles.body}>
        <PlaceRow imageUrl={salonImageUrl} name={salonName} caption={salonArea} />

        <View style={styles.card}>
          <Fact icon="calendar-outline" title="When" text={`${dateLabel} · ${timeLabel}`} />
          {staffLabel ? <Fact icon="person-outline" title="Specialist" text={staffLabel} /> : null}
          <Fact
            icon="id-card-outline"
            title="Guest"
            text={`${customerName} · ${customerPhone}\n${customerEmail}`}
          />
          {notes ? <Fact icon="chatbubble-ellipses-outline" title="Note" text={notes} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={ui.sectionLabel}>Services</Text>
          {serviceLines.map((line) => (
            <View key={`${line.title}-${line.subtitle}`} style={styles.serviceRow}>
              <View style={styles.factCopy}>
                <Text style={styles.serviceTitle} numberOfLines={2}>
                  {line.title}
                </Text>
                {line.subtitle ? <Text style={styles.serviceSub}>{line.subtitle}</Text> : null}
              </View>
              <Text style={styles.servicePrice}>{line.priceLabel}</Text>
            </View>
          ))}
          <Hairline />
          {priceLines.map((line) => (
            <ReceiptRow
              key={line.label}
              label={line.label}
              value={line.value}
              tone={line.success ? "success" : line.muted ? "muted" : "default"}
            />
          ))}
          <ReceiptTotal label="Pay at salon" value={totalLabel} />
        </View>

        {error ? (
          <Notice tone="red" icon="alert-circle-outline">
            {error}
          </Notice>
        ) : null}

        <PrimaryPill
          label={submitting ? "Booking…" : "Book and confirm"}
          loading={submitting}
          disabled={submitting}
          onPress={onConfirm}
        />
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingBottom: 12 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: bk.border,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 12,
  },
  fact: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  factIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: bk.peachBg,
    alignItems: "center",
    justifyContent: "center",
  },
  factCopy: { flex: 1, minWidth: 0, gap: 2 },
  factTitle: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, color: bk.secondary },
  factText: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, color: bk.text },
  serviceRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  serviceTitle: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: bk.text },
  serviceSub: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: bk.secondary },
  servicePrice: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20, color: bk.text },
})
