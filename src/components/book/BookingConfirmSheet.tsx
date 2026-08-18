import { Image } from "expo-image"
import { StyleSheet, View } from "react-native"

import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { Text } from "@/components/ui/Text"
import { colors, radii, spacing } from "@/theme/tokens"

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
        <View style={styles.salonRow}>
          <Image
            source={{ uri: salonImageUrl }}
            style={styles.salonAvatar}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.salonCopy}>
            <Text variant="label" muted>
              Salon
            </Text>
            <Text variant="heading" numberOfLines={2}>
              {salonName}
            </Text>
            <Text muted numberOfLines={1}>
              {salonArea}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="label" muted>
            Services
          </Text>
          {serviceLines.map((line) => (
            <View key={`${line.title}-${line.subtitle}`} style={styles.serviceRow}>
              <View style={styles.serviceCopy}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {line.title}
                </Text>
                {line.subtitle ? (
                  <Text variant="caption" muted>
                    {line.subtitle}
                  </Text>
                ) : null}
              </View>
              <Text variant="bodyStrong">{line.priceLabel}</Text>
            </View>
          ))}
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Text variant="label" muted>
              Date
            </Text>
            <Text variant="bodyStrong">{dateLabel}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text variant="label" muted>
              Time
            </Text>
            <Text variant="bodyStrong">{timeLabel}</Text>
          </View>
        </View>

        {staffLabel ? (
          <View style={styles.section}>
            <Text variant="label" muted>
              Specialist
            </Text>
            <Text variant="bodyStrong">{staffLabel}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="label" muted>
            Guest
          </Text>
          <Text variant="bodyStrong">{customerName}</Text>
          <Text muted>{customerPhone}</Text>
          <Text muted>{customerEmail}</Text>
          {notes ? (
            <Text variant="caption" muted style={styles.notes}>
              Note · {notes}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text variant="label" muted>
            Payment
          </Text>
          {priceLines.map((line) => (
            <View key={line.label} style={styles.priceRow}>
              <Text muted={line.muted !== false && !line.emphasis}>{line.label}</Text>
              <Text
                variant={line.emphasis ? "bodyStrong" : "body"}
                color={line.success ? colors.success : undefined}
              >
                {line.value}
              </Text>
            </View>
          ))}
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text variant="bodyStrong">Pay at salon</Text>
            <Text variant="heading">{totalLabel}</Text>
          </View>
        </View>

        {error ? (
          <Text variant="caption" color={colors.coral}>
            {error}
          </Text>
        ) : null}

        <Button
          label={submitting ? "Booking…" : "Book and confirm"}
          loading={submitting}
          disabled={submitting}
          onPress={onConfirm}
          style={styles.cta}
        />
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.xl,
    paddingBottom: spacing.md,
  },
  salonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  salonAvatar: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
  },
  salonCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  section: {
    gap: spacing.sm,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  serviceCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  metaGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  metaCard: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  notes: {
    marginTop: spacing.xs,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  totalRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cta: {
    marginTop: spacing.sm,
  },
})
