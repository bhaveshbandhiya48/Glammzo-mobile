import type { ReactNode } from "react"
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GradientFill } from "@/components/home/GradientFill"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

/**
 * Shared pieces of the "See all" list screens (salons, artists): peach header with a round
 * back button, search field, sticky chip row, and the empty / error card.
 */

export function SeeAllHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string
  subtitle: string
  onBack: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={6}
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Icon name="chevron-back" size={20} color="#111111" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  )
}

export function SeeAllSearch({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (next: string) => void
  label: string
}) {
  return (
    <View style={styles.searchPad}>
      <View style={styles.search}>
        <Icon name="search-outline" size={18} color="#595959" />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Search by name, area or service"
          accessibilityLabel={label}
          placeholderTextColor="#8a8a8a"
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange("")} hitSlop={8}>
            <Icon name="close-circle" size={18} color="#8a8a8a" />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

/** Horizontal chip row on a white band, used as the list's sticky header. */
export function SeeAllChipRow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.chipBand}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        directionalLockEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
      >
        {children}
      </ScrollView>
    </View>
  )
}

/** Discovery chip: active black, inactive white with a #e3e3e3 border. */
export function SeeAllChip({
  label,
  on,
  onPress,
  icon,
  trailing,
  a11y,
}: {
  label: string
  on: boolean
  onPress: () => void
  icon?: IconName
  trailing?: IconName
  a11y?: string
}) {
  const ink = on ? "#ffffff" : "#111111"
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && !on && styles.chipPressed]}
    >
      {icon ? <Icon name={icon} size={15} color={ink} /> : null}
      <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
        {label}
      </Text>
      {trailing ? <Icon name={trailing} size={14} color={ink} /> : null}
    </Pressable>
  )
}

export function SeeAllClearLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Clear all filters"
      onPress={onPress}
      hitSlop={8}
      style={styles.clearLink}
    >
      <Text style={styles.clearLinkText}>Clear all</Text>
    </Pressable>
  )
}

/** Pastel empty / error card with an optional pill action ("Clear filters", "Try again"). */
export function SeeAllEmpty({
  icon,
  colors,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: IconName
  colors: [string, string]
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View style={styles.emptyPad}>
      <View style={styles.empty}>
        <GradientFill colors={colors} angle={150} radius={20} />
        <View style={styles.emptyIcon}>
          <Icon name={icon} size={22} color="#111111" />
        </View>
        <Text style={styles.emptyTitle} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.emptyBody}>{body}</Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [styles.action, pressed && styles.chipPressed]}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

export const SEE_ALL_EMPTY_COLORS = {
  salons: ["#fff4ef", "#ffe1d6"] as [string, string],
  artists: ["#f7f2ff", "#e6dcff"] as [string, string],
  error: ["#f1f8fe", "#d9ebfb"] as [string, string],
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: "#111111",
  },
  subtitle: {
    marginTop: 1,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
  },
  searchPad: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 6,
    backgroundColor: "#ffffff",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    backgroundColor: "#ffffff",
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: "#111111",
    paddingVertical: 10,
  },
  chipBand: {
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  chips: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipOn: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
  chipPressed: {
    backgroundColor: "#f6f6f6",
  },
  chipText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: "#111111",
  },
  chipTextOn: {
    color: "#ffffff",
  },
  clearLink: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  clearLinkText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: "#111111",
    textDecorationLine: "underline",
  },
  emptyPad: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  empty: {
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: "#111111",
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
    textAlign: "center",
  },
  action: {
    marginTop: 16,
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e3e3e3",
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: "#111111",
  },
})

/** Radio option row for the new-style sheets (sort, single-choice filters). */
export function SheetRadioRow({
  label,
  detail,
  on,
  onPress,
  last,
}: {
  label: string
  detail?: string
  on: boolean
  onPress: () => void
  last?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on, checked: on }}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => [radioStyles.row, !last && radioStyles.divider, pressed && radioStyles.pressed]}
    >
      <View style={radioStyles.text}>
        <Text style={[radioStyles.label, on && radioStyles.labelOn]}>{label}</Text>
        {detail ? <Text style={radioStyles.detail}>{detail}</Text> : null}
      </View>
      <View style={[radioStyles.ring, on && radioStyles.ringOn]}>{on ? <View style={radioStyles.dot} /> : null}</View>
    </Pressable>
  )
}

const radioStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 54,
    paddingVertical: 12,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 20,
    color: "#111111",
  },
  labelOn: {
    fontFamily: fontFamily.semibold,
  },
  detail: {
    marginTop: 1,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
  },
  ring: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#c9c9c9",
    alignItems: "center",
    justifyContent: "center",
  },
  ringOn: {
    borderColor: "#111111",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#111111",
  },
})
