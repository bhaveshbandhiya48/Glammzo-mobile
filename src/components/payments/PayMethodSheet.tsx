import { useMemo, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { BankIcon, Option, POPULAR_BANKS, UpiIcon } from "@/components/payments/AdvancePaymentSheet"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
import { SkeletonBone } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import type { Bank, UpiApp } from "@/lib/advance-payment"
import type { PaySelection, SavedPayMethod } from "@/lib/pay-method-memory"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  visible: boolean
  loading: boolean
  upiApps: UpiApp[]
  banks: Bank[]
  selected: PaySelection | null
  /** Marks this option "Last used". */
  lastUsed: SavedPayMethod | null
  onPick: (selection: PaySelection) => void
  onClose: () => void
}

function isSelected(selected: PaySelection | null, candidate: PaySelection) {
  if (!selected || selected.kind !== candidate.kind) return false
  if (selected.kind === "upi" && candidate.kind === "upi") return selected.app.packageName === candidate.app.packageName
  if (selected.kind === "bank" && candidate.kind === "bank") return selected.bank.code === candidate.bank.code
  return selected.kind === "card"
}

/** "Pay using": the full list behind the checkout bar. Picking an option closes it. */
export function PayMethodSheet({ visible, loading, upiApps, banks, selected, lastUsed, onPick, onClose }: Props) {
  const [choosingBank, setChoosingBank] = useState(false)
  const [bankQuery, setBankQuery] = useState("")

  const popularBanks = useMemo(() => {
    const popular = POPULAR_BANKS.map((code) => banks.find((b) => b.code === code)).filter((b): b is Bank => b != null)
    return popular.length > 0 ? popular : banks.slice(0, 5)
  }, [banks])
  const shownBanks = useMemo(() => {
    const q = bankQuery.trim().toLowerCase()
    return q ? banks.filter((b) => b.name.toLowerCase().includes(q)) : banks
  }, [bankQuery, banks])

  function pick(selection: PaySelection) {
    setChoosingBank(false)
    setBankQuery("")
    onPick(selection)
  }

  if (choosingBank) {
    return (
      <BottomSheet
        visible={visible}
        title="Choose your bank"
        expanded
        contentKey="banks"
        onClose={() => {
          setChoosingBank(false)
          setBankQuery("")
          onClose()
        }}
        stickyHeader={
          <Input value={bankQuery} onChangeText={setBankQuery} placeholder="Search banks" accessibilityLabel="Search banks" />
        }
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setChoosingBank(false)
            setBankQuery("")
          }}
          style={styles.backRow}
        >
          <Icon name="chevron-back" size={18} color={colors.text} />
          <Text variant="bodyStrong">Back to payment options</Text>
        </Pressable>
        {shownBanks.map((bank) => (
          <Option
            key={bank.code}
            title={bank.name}
            leading={<BankIcon code={bank.code} />}
            selected={isSelected(selected, { kind: "bank", bank })}
            onPress={() => pick({ kind: "bank", bank })}
          />
        ))}
        {shownBanks.length === 0 ? (
          <Text variant="caption" muted style={styles.empty}>
            No bank found.
          </Text>
        ) : null}
      </BottomSheet>
    )
  }

  const selectedBankOutsidePopular =
    selected?.kind === "bank" && !popularBanks.some((b) => b.code === selected.bank.code) ? selected.bank : null

  return (
    <BottomSheet visible={visible} title="Pay using" contentKey="methods" onClose={onClose}>
      {loading ? (
        <View style={styles.card} accessibilityLabel="Loading payment options">
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.skeletonRow}>
              <SkeletonBone width={40} height={40} radius={radii.md} />
              <SkeletonBone width="55%" />
            </View>
          ))}
        </View>
      ) : (
        <>
          <Text variant="label" muted style={styles.sectionTitle}>
            UPI apps
          </Text>
          <View style={styles.card} accessibilityRole="radiogroup">
            {upiApps.length === 0 ? (
              <Text variant="caption" muted style={styles.empty}>
                No UPI apps found on this phone. You can pay by net banking or card.
              </Text>
            ) : null}
            {upiApps.map((app) => (
              <Option
                key={app.packageName}
                title={app.name}
                subtitle={lastUsed?.kind === "upi" && lastUsed.packageName === app.packageName ? "Last used" : undefined}
                leading={<UpiIcon app={app} />}
                selected={isSelected(selected, { kind: "upi", app })}
                onPress={() => pick({ kind: "upi", app })}
              />
            ))}
          </View>

          {banks.length > 0 ? (
            <>
              <Text variant="label" muted style={styles.sectionTitle}>
                Net banking
              </Text>
              <View style={styles.card} accessibilityRole="radiogroup">
                {popularBanks.map((bank) => (
                  <Option
                    key={bank.code}
                    title={bank.name}
                    subtitle={lastUsed?.kind === "bank" && lastUsed.code === bank.code ? "Last used" : undefined}
                    leading={<BankIcon code={bank.code} />}
                    selected={isSelected(selected, { kind: "bank", bank })}
                    onPress={() => pick({ kind: "bank", bank })}
                  />
                ))}
                {selectedBankOutsidePopular ? (
                  <Option
                    title={selectedBankOutsidePopular.name}
                    leading={<BankIcon code={selectedBankOutsidePopular.code} />}
                    selected
                    onPress={() => pick({ kind: "bank", bank: selectedBankOutsidePopular })}
                  />
                ) : null}
                <Option
                  chevron
                  title="All banks"
                  leading={<Icon name="business-outline" size={20} />}
                  onPress={() => setChoosingBank(true)}
                />
              </View>
            </>
          ) : null}

          <Text variant="label" muted style={styles.sectionTitle}>
            Credit or debit card
          </Text>
          <View style={styles.card}>
            <Option
              chevron
              title="Pay by card"
              subtitle="Opens Glammzo's secure payment page"
              leading={<Icon name="card-outline" size={20} />}
              onPress={() => pick({ kind: "card" })}
            />
          </View>

          <Text variant="caption" muted style={styles.secure}>
            Secure payment by Razorpay
          </Text>
        </>
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.md,
  },
  empty: { padding: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 44 },
  secure: { textAlign: "center", marginTop: spacing.lg },
})
