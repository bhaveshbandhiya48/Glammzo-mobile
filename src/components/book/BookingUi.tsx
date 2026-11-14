import { Image } from "expo-image"
import type { ReactNode } from "react"
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GradientFill } from "@/components/home/GradientFill"
import { PastelIcon, type Pastel } from "@/components/profile/ProfileParts"
import { sp, ui } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

/** Booking-flow tokens (same palette as the salon page and Profile screens). */
export const bk = {
  ...sp,
  green: "#17633e",
  greenBg: "#e6f5ec",
  red: "#c0392b",
  redBg: "#fdecea",
  muted: "#8a8a8a",
  inputBg: "#fafafa",
  disabled: "#d4d4d4",
} as const

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

/** Peach gradient header: round back button, 22/700 title, step dots. */
export function BookingHeader({
  title,
  subtitle,
  step,
  steps,
  onBack,
  backLabel = "Go back",
}: {
  title: string
  subtitle?: string | null
  /** 0-based current step. */
  step?: number
  steps?: string[]
  onBack: () => void
  backLabel?: string
}) {
  const insets = useSafeAreaInsets()
  const hasSteps = steps && steps.length > 1 && step != null
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={6}
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && ui.pressed]}
        >
          <Icon name="chevron-back" size={20} color={bk.text} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {hasSteps ? (
        <View
          style={styles.steps}
          accessible
          accessibilityLabel={`Step ${step + 1} of ${steps.length}: ${steps[step]}`}
        >
          {steps.map((label, index) => {
            const done = index < step
            const active = index === step
            return (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepBar, (done || active) && styles.stepBarOn]} />
                <Text
                  style={[styles.stepText, active && styles.stepTextActive, done && styles.stepTextDone]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Cards & labels                                                      */
/* ------------------------------------------------------------------ */

export function BookingSectionLabel({
  children,
  action,
  first,
}: {
  children: string
  action?: { label: string; onPress: () => void }
  first?: boolean
}) {
  return (
    <View style={[styles.sectionRow, first && styles.sectionRowFirst]}>
      <Text style={ui.sectionLabel}>{children}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={action.onPress}
          style={({ pressed }) => pressed && ui.pressed}
        >
          <Text style={styles.sectionAction}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function BookingCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

/** Thin divider inside a card. */
export function Hairline() {
  return <View style={styles.hairline} />
}

/** Place / provider summary row: photo, name, area. */
export function PlaceRow({
  imageUrl,
  name,
  caption,
  meta,
}: {
  imageUrl?: string | null
  name: string
  caption?: string | null
  meta?: string | null
}) {
  return (
    <View style={styles.placeRow}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.placePhoto} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.placePhoto, styles.placePhotoEmpty]}>
          <Icon name="storefront-outline" size={22} color={bk.secondary} />
        </View>
      )}
      <View style={styles.placeCopy}>
        <Text style={styles.placeName} numberOfLines={1}>
          {name}
        </Text>
        {caption ? (
          <Text style={styles.placeCaption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
        {meta ? (
          <Text style={styles.placeMeta} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

/** One line of the bag: thumb, name, caption, price, remove. */
export function ServiceLine({
  imageUrl,
  title,
  caption,
  price,
  onRemove,
  removeLabel,
  tag,
}: {
  imageUrl?: string | null
  title: string
  caption?: string | null
  price: string
  onRemove?: () => void
  removeLabel?: string
  tag?: string | null
}) {
  return (
    <View style={styles.serviceLine}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.serviceThumb} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.serviceThumb, styles.placePhotoEmpty]}>
          <Icon name="sparkles-outline" size={18} color={bk.secondary} />
        </View>
      )}
      <View style={styles.serviceCopy}>
        {tag ? <Text style={styles.serviceTag}>{tag}</Text> : null}
        <Text style={styles.serviceTitle} numberOfLines={2}>
          {title}
        </Text>
        {caption ? (
          <Text style={styles.serviceCaption} numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
      </View>
      <View style={styles.serviceRight}>
        <Text style={styles.servicePrice}>{price}</Text>
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={removeLabel ?? `Remove ${title}`}
            hitSlop={10}
            onPress={onRemove}
            style={({ pressed }) => [styles.remove, pressed && ui.pressed]}
          >
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Receipt                                                             */
/* ------------------------------------------------------------------ */

export type ReceiptTone = "default" | "success" | "muted"

export function ReceiptRow({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: ReceiptTone
}) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text
        style={[
          styles.receiptValue,
          tone === "success" && styles.receiptSuccess,
          tone === "muted" && styles.receiptMuted,
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

export function ReceiptTotal({ label, value, caption }: { label: string; value: string; caption?: string | null }) {
  return (
    <View style={styles.receiptTotal}>
      <View style={styles.receiptTotalCopy}>
        <Text style={styles.receiptTotalLabel}>{label}</Text>
        {caption ? <Text style={styles.receiptCaption}>{caption}</Text> : null}
      </View>
      <Text style={styles.receiptTotalValue}>{value}</Text>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Toggle rows (wallet / loyalty / opt-in)                              */
/* ------------------------------------------------------------------ */

export function ToggleRow({
  pastel,
  icon,
  title,
  caption,
  on,
  disabled,
  badge,
  onPress,
  accessibilityLabel,
}: {
  pastel: Pastel
  icon: IconName
  title: string
  caption?: string | null
  on: boolean
  disabled?: boolean
  /** Shown instead of the switch when the row can't be used (e.g. "Locked"). */
  badge?: string | null
  onPress: () => void
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ checked: on, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.toggleRow, disabled && styles.toggleDisabled, pressed && ui.pressed]}
    >
      <PastelIcon pastel={pastel} name={icon} />
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {caption ? <Text style={styles.toggleCaption}>{caption}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <View style={[styles.switch, on && styles.switchOn]}>
          <View style={[styles.knob, on && styles.knobOn]} />
        </View>
      )}
    </Pressable>
  )
}

/** Square checkbox row (WhatsApp opt-in and similar). */
export function CheckRow({
  checked,
  title,
  caption,
  onPress,
  accessibilityLabel,
}: {
  checked: boolean
  title: string
  caption?: string | null
  onPress: () => void
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.checkRow, pressed && ui.pressed]}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked ? <Icon name="checkmark" size={14} color="#ffffff" /> : null}
      </View>
      <View style={styles.toggleCopy}>
        <Text style={styles.checkTitle}>{title}</Text>
        {caption ? <Text style={styles.toggleCaption}>{caption}</Text> : null}
      </View>
    </Pressable>
  )
}

/* ------------------------------------------------------------------ */
/* Stylist / date / time pickers                                        */
/* ------------------------------------------------------------------ */

export type StylistOption = {
  id: string
  name: string
  role?: string | null
  imageUrl?: string | null
}

/** Horizontal avatar cards; "Any stylist" first when there's a choice. */
export function StylistPicker({
  staff,
  value,
  onSelect,
  showAny,
  anyLabel = "Any stylist",
}: {
  staff: StylistOption[]
  value: string | null
  onSelect: (id: string | null) => void
  showAny: boolean
  anyLabel?: string
}) {
  const cards: (StylistOption & { any?: boolean })[] = [
    ...(showAny ? [{ id: "__any", name: anyLabel, role: "First free", any: true }] : []),
    ...staff,
  ]
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.hScroll}
      accessibilityRole="radiogroup"
    >
      {cards.map((member) => {
        const active = member.any ? value == null : value === member.id
        return (
          <Pressable
            key={member.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={member.role ? `${member.name}, ${member.role}` : member.name}
            onPress={() => onSelect(member.any ? null : member.id)}
            style={({ pressed }) => [styles.stylist, active && styles.stylistActive, pressed && ui.pressed]}
          >
            <View style={[styles.avatar, active && styles.avatarActive]}>
              {member.any ? (
                <>
                  <GradientFill colors={["#fff4ef", "#ffe1d6"]} angle={150} />
                  <Icon name="people-outline" size={22} color="#3b2a24" />
                </>
              ) : member.imageUrl ? (
                <Image source={{ uri: member.imageUrl }} style={styles.avatarImg} contentFit="cover" transition={200} />
              ) : (
                <>
                  <GradientFill colors={["#f7f2ff", "#e6dcff"]} angle={150} />
                  <Text style={styles.avatarInitial}>{member.name.trim().charAt(0).toUpperCase() || "?"}</Text>
                </>
              )}
            </View>
            <Text style={styles.stylistName} numberOfLines={1}>
              {member.name}
            </Text>
            {member.role ? (
              <Text style={styles.stylistRole} numberOfLines={1}>
                {member.role}
              </Text>
            ) : null}
            {active ? (
              <View style={styles.stylistCheck}>
                <Icon name="checkmark" size={11} color="#ffffff" />
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

export type DayOption = { date: string; disabled?: boolean }

function dayParts(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return { top: "", day: dateKey, month: "" }
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  const top =
    diff === 0
      ? "Today"
      : diff === 1
        ? "Tmrw"
        : date.toLocaleDateString("en-IN", { weekday: "short" })
  return {
    top,
    day: String(date.getDate()),
    month: date.toLocaleDateString("en-IN", { month: "short" }),
  }
}

/** Horizontal row of day chips: weekday (or Today / Tmrw), date, month. */
export function DayStrip({
  options,
  value,
  onSelect,
}: {
  options: DayOption[]
  value: string | null
  onSelect: (date: string) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.hScroll}
      accessibilityRole="radiogroup"
    >
      {options.map((option) => {
        const active = option.date === value && !option.disabled
        const parts = dayParts(option.date)
        return (
          <Pressable
            key={option.date}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled: !!option.disabled }}
            accessibilityLabel={`${parts.top} ${parts.day} ${parts.month}${option.disabled ? ", unavailable" : ""}`}
            disabled={option.disabled}
            onPress={() => onSelect(option.date)}
            style={({ pressed }) => [
              styles.day,
              active && styles.dayActive,
              option.disabled && styles.dayDisabled,
              pressed && !active && ui.pressed,
            ]}
          >
            <Text style={[styles.dayTop, active && styles.dayTextActive]}>{parts.top}</Text>
            <Text style={[styles.dayNum, active && styles.dayTextActive, option.disabled && styles.dayStrike]}>
              {parts.day}
            </Text>
            <Text style={[styles.dayMonth, active && styles.dayTextActive]}>{parts.month}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

export type TimeOption = { value: string; label: string; disabled?: boolean }
type Part = "Morning" | "Afternoon" | "Evening"

/** "10:00 am" → "10:00 AM", so salon and artist times read the same. */
export function displayTime(label: string) {
  return label.replace(/\b(am|pm)\b/i, (m) => m.toUpperCase())
}

export function partOfDay(label: string): Part {
  const m = label.match(/(\d{1,2})(?::\d{2})?\s*(am|pm)?/i)
  let hour = m ? Number(m[1]) : 9
  const suffix = m?.[2]?.toLowerCase()
  if (suffix === "pm" && hour < 12) hour += 12
  if (suffix === "am" && hour === 12) hour = 0
  return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"
}

const PART_ICONS: Record<Part, IconName> = {
  Morning: "sunny-outline",
  Afternoon: "partly-sunny-outline",
  Evening: "moon-outline",
}

/** Time chips grouped MORNING / AFTERNOON / EVENING; earliest free time marked. */
export function TimeGrid({
  options,
  value,
  onSelect,
  loading,
  emptyMessage,
}: {
  options: TimeOption[]
  value: string | null
  onSelect: (value: string) => void
  loading?: boolean
  emptyMessage?: string | null
}) {
  if (loading) {
    return (
      <View style={styles.timeSkeleton} accessibilityLabel="Loading available times">
        {Array.from({ length: 6 }).map((_, index) => (
          <View key={index} style={styles.timeGhost} />
        ))}
      </View>
    )
  }
  if (options.length === 0) {
    return (
      <View style={styles.timeEmpty}>
        <Icon name="time-outline" size={18} color={bk.secondary} />
        <Text style={styles.timeEmptyText}>{emptyMessage || "No times left on this day."}</Text>
      </View>
    )
  }
  const firstFree = options.find((slot) => !slot.disabled)?.value ?? null
  const groups = (["Morning", "Afternoon", "Evening"] as Part[])
    .map((part) => ({ part, slots: options.filter((slot) => partOfDay(slot.label) === part) }))
    .filter((group) => group.slots.length > 0)

  return (
    <View style={styles.timeGroups}>
      {groups.map((group) => (
        <View key={group.part} style={styles.timeGroup}>
          <View style={styles.timeGroupHead}>
            <Icon name={PART_ICONS[group.part]} size={13} color={bk.label} />
            <Text style={ui.sectionLabel}>{group.part}</Text>
          </View>
          <View style={styles.timeGrid}>
            {group.slots.map((slot) => {
              const active = value === slot.value && !slot.disabled
              const earliest = slot.value === firstFree
              const label = displayTime(slot.label)
              return (
                <Pressable
                  key={slot.value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${label}${earliest ? ", earliest available" : ""}${slot.disabled ? ", unavailable" : ""}`}
                  accessibilityState={{ selected: active, disabled: !!slot.disabled }}
                  disabled={slot.disabled}
                  onPress={() => onSelect(slot.value)}
                  style={({ pressed }) => [
                    styles.slot,
                    active && styles.slotActive,
                    slot.disabled && styles.slotDisabled,
                    pressed && !active && ui.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.slotText,
                      active && styles.slotTextActive,
                      slot.disabled && styles.slotTextDisabled,
                    ]}
                  >
                    {label}
                  </Text>
                  {earliest && !slot.disabled ? (
                    <Text style={[styles.slotEarliest, active && styles.slotEarliestActive]}>Earliest</Text>
                  ) : null}
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Notices & bottom bar                                                */
/* ------------------------------------------------------------------ */

export function Notice({
  tone = "peach",
  icon = "information-circle-outline",
  children,
}: {
  tone?: "peach" | "red" | "green" | "grey"
  icon?: IconName
  children: ReactNode
}) {
  const palette =
    tone === "red"
      ? { bg: bk.redBg, fg: bk.red }
      : tone === "green"
        ? { bg: bk.greenBg, fg: bk.green }
        : tone === "grey"
          ? { bg: "#f2f2f2", fg: bk.secondary }
          : { bg: bk.peachBg, fg: bk.peachInk }
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg }]}>
      <Icon name={icon} size={16} color={palette.fg} />
      <Text style={[styles.noticeText, { color: palette.fg }]}>{children}</Text>
    </View>
  )
}

export const BOOKING_BAR_SPACE = 132

/**
 * White bar under the scroll view: price + caption on the left, black 52 pill
 * on the right. Render it after the ScrollView inside a KeyboardAvoidingView so
 * it rides above the keyboard.
 */
export function BookingBar({
  title,
  caption,
  label,
  onPress,
  disabled,
  loading,
  error,
}: {
  title: string
  caption?: string | null
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  error?: string | null
}) {
  const insets = useSafeAreaInsets()
  const off = disabled || loading
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {error ? (
        <Text style={styles.barError} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <View style={styles.barRow}>
        <View style={styles.barCopy}>
          <Text style={styles.barTitle} numberOfLines={1}>
            {title}
          </Text>
          {caption ? (
            <Text style={styles.barCaption} numberOfLines={2}>
              {caption}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: !!off, busy: !!loading }}
          disabled={off}
          onPress={onPress}
          style={({ pressed }) => [styles.barCta, off && !loading && styles.barCtaOff, pressed && ui.pressed]}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.barCtaText} numberOfLines={1}>
              {label}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

/** Simple grey blocks while the booking screen loads. */
export function BookingSkeleton() {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.page, { paddingTop: insets.top + 16 }]} accessibilityLabel="Loading booking">
      <View style={styles.skelHead}>
        <View style={styles.skelCircle} />
        <View style={styles.skelTitle} />
      </View>
      <View style={styles.skelSteps} />
      {[120, 180, 140].map((height, index) => (
        <View key={index} style={[styles.skelCard, { height }]} />
      ))}
    </View>
  )
}

const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
  default: { elevation: 12 },
})!

export const bookingStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  body: { paddingHorizontal: 16 },
  fieldStack: { gap: 14 },
})

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: bk.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, color: bk.text },
  subtitle: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: bk.secondary },
  steps: { flexDirection: "row", gap: 8, marginTop: 16 },
  stepItem: { flex: 1, gap: 6 },
  stepBar: { height: 4, borderRadius: 2, backgroundColor: "#ececec" },
  stepBarOn: { backgroundColor: bk.text },
  stepText: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, color: bk.muted },
  stepTextActive: { fontFamily: fontFamily.semibold, color: bk.text },
  stepTextDone: { color: bk.secondary },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionRowFirst: { marginTop: 8 },
  sectionAction: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 17, color: bk.text, textDecorationLine: "underline" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: bk.border,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 14,
  },
  hairline: { height: 1, backgroundColor: bk.hairline },

  placeRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  placePhoto: { width: 64, height: 64, borderRadius: 14, backgroundColor: bk.grey },
  placePhotoEmpty: { alignItems: "center", justifyContent: "center" },
  placeCopy: { flex: 1, minWidth: 0, gap: 2 },
  placeName: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22, color: bk.text },
  placeCaption: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: bk.secondary },
  placeMeta: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: bk.muted },

  serviceLine: { flexDirection: "row", alignItems: "center", gap: 12 },
  serviceThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: bk.grey },
  serviceCopy: { flex: 1, minWidth: 0, gap: 2 },
  serviceTag: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: bk.peachInk,
  },
  serviceTitle: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: bk.text },
  serviceCaption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: bk.secondary },
  serviceRight: { alignItems: "flex-end", gap: 6 },
  servicePrice: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20, color: bk.text },
  remove: { paddingVertical: 2 },
  removeText: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, color: bk.secondary, textDecorationLine: "underline" },

  receiptRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  receiptLabel: { flex: 1, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: bk.secondary },
  receiptValue: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: bk.text },
  receiptSuccess: { color: bk.green, fontFamily: fontFamily.semibold },
  receiptMuted: { color: bk.muted },
  receiptTotal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: bk.hairline,
    borderStyle: "dashed",
  },
  receiptTotalCopy: { flex: 1, gap: 2 },
  receiptTotalLabel: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 21, color: bk.text },
  receiptCaption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: bk.secondary },
  receiptTotalValue: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24, color: bk.text },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  toggleDisabled: { opacity: 0.55 },
  toggleCopy: { flex: 1, minWidth: 0, gap: 2 },
  toggleTitle: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: bk.text },
  toggleCaption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: bk.secondary },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#e5e5e5",
    padding: 3,
    justifyContent: "center",
  },
  switchOn: { backgroundColor: bk.text },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#ffffff" },
  knobOn: { alignSelf: "flex-end" },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: "#f2f2f2" },
  badgeText: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, color: bk.secondary },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#bdbdbd",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkBoxOn: { backgroundColor: bk.text, borderColor: bk.text },
  checkTitle: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: bk.text },

  hScroll: { gap: 10, paddingHorizontal: 16, paddingVertical: 2 },
  stylist: {
    width: 96,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: bk.border,
    backgroundColor: "#ffffff",
    gap: 2,
  },
  stylistActive: { borderColor: bk.text, borderWidth: 2, paddingVertical: 13, paddingHorizontal: 7 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: bk.grey,
    marginBottom: 6,
  },
  avatarActive: {},
  avatarImg: { width: 52, height: 52 },
  avatarInitial: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 24, color: "#2e2440" },
  stylistName: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 17, color: bk.text, textAlign: "center" },
  stylistRole: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 14, color: bk.secondary, textAlign: "center" },
  stylistCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: bk.text,
    alignItems: "center",
    justifyContent: "center",
  },

  day: {
    width: 62,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: bk.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    gap: 1,
  },
  dayActive: { backgroundColor: bk.text, borderColor: bk.text },
  dayDisabled: { backgroundColor: "#f7f7f7", borderColor: "#efefef" },
  dayTop: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 14, color: bk.secondary },
  dayNum: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, color: bk.text },
  dayMonth: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 14, color: bk.secondary },
  dayTextActive: { color: "#ffffff" },
  dayStrike: { color: "#b5b5b5", textDecorationLine: "line-through" },

  timeGroups: { gap: 16 },
  timeGroup: { gap: 10 },
  timeGroupHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: {
    width: "31.5%",
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: bk.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  slotActive: { backgroundColor: bk.text, borderColor: bk.text },
  slotDisabled: { backgroundColor: "#f7f7f7", borderColor: "#efefef" },
  slotText: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 17, color: bk.text },
  slotTextActive: { color: "#ffffff" },
  slotTextDisabled: { color: "#b5b5b5", textDecorationLine: "line-through" },
  slotEarliest: { fontFamily: fontFamily.medium, fontSize: 10, lineHeight: 12, color: bk.green },
  slotEarliestActive: { color: "#bfe8cf" },
  timeSkeleton: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeGhost: { width: "31.5%", height: 44, borderRadius: 12, backgroundColor: bk.grey },
  timeEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f7f7f7",
  },
  timeEmptyText: { flex: 1, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: bk.secondary },

  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12 },
  noticeText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },

  bar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: bk.hairline,
    ...shadow,
  },
  barError: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, color: bk.red },
  barRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  barCopy: { flex: 1, minWidth: 0, gap: 2 },
  barTitle: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22, color: bk.text },
  barCaption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: bk.secondary },
  barCta: {
    height: 52,
    minWidth: 132,
    maxWidth: "58%",
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: bk.text,
    alignItems: "center",
    justifyContent: "center",
  },
  barCtaOff: { backgroundColor: bk.disabled },
  barCtaText: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 21, color: "#ffffff" },

  skelHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  skelCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: bk.grey },
  skelTitle: { width: 160, height: 22, borderRadius: 6, backgroundColor: bk.grey },
  skelSteps: { height: 4, borderRadius: 2, marginHorizontal: 16, marginTop: 22, marginBottom: 8, backgroundColor: bk.grey },
  skelCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, backgroundColor: bk.grey },
})

/* ------------------------------------------------------------------ */
/* Success state                                                       */
/* ------------------------------------------------------------------ */

/**
 * Full-page "done" state for the smaller flows (reschedule, review): peach wash,
 * pastel icon, title, message, an optional summary card, and a black 52 pill.
 */
export function FlowSuccess({
  icon = "checkmark",
  pastel,
  title,
  message,
  children,
  primary,
  secondary,
}: {
  icon?: IconName
  pastel: Pastel
  title: string
  message: string
  children?: ReactNode
  primary: { label: string; onPress: () => void }
  secondary?: { label: string; onPress: () => void }
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[successStyles.scroll, { paddingTop: insets.top + 48, paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={successStyles.wash} pointerEvents="none">
          <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />
        </View>
        <View style={successStyles.badge}>
          <PastelIcon pastel={pastel} name={icon} size={72} />
        </View>
        <Text style={successStyles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={successStyles.message}>{message}</Text>
        {children ? <View style={[styles.card, successStyles.card]}>{children}</View> : null}
      </ScrollView>
      <View style={[successStyles.actions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          accessibilityRole="button"
          onPress={primary.onPress}
          style={({ pressed }) => [successStyles.primary, pressed && ui.pressed]}
        >
          <Text style={successStyles.primaryText}>{primary.label}</Text>
        </Pressable>
        {secondary ? (
          <Pressable
            accessibilityRole="button"
            onPress={secondary.onPress}
            hitSlop={6}
            style={({ pressed }) => [successStyles.secondary, pressed && ui.pressed]}
          >
            <Text style={successStyles.secondaryText}>{secondary.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

/** Label / value line inside a FlowSuccess card. */
export function SuccessLine({ label, value, struck }: { label: string; value: string; struck?: boolean }) {
  return (
    <View style={successStyles.line}>
      <Text style={successStyles.lineLabel}>{label}</Text>
      <Text
        style={[successStyles.lineValue, struck && successStyles.lineStruck]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  )
}

const successStyles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, alignItems: "center" },
  wash: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  badge: { borderRadius: 24, overflow: "hidden", marginBottom: 20 },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: bk.text,
    textAlign: "center",
  },
  message: {
    marginTop: 6,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 21,
    color: bk.secondary,
    textAlign: "center",
    maxWidth: 320,
  },
  card: { alignSelf: "stretch", marginTop: 28, gap: 12 },
  line: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  lineLabel: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: bk.secondary },
  lineValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: bk.text,
  },
  lineStruck: { fontFamily: fontFamily.regular, color: bk.muted, textDecorationLine: "line-through" },
  actions: { paddingHorizontal: 20, paddingTop: 12, gap: 8, backgroundColor: "#ffffff" },
  primary: {
    height: 52,
    borderRadius: 999,
    backgroundColor: bk.text,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 20, color: "#ffffff" },
  secondary: { height: 44, alignItems: "center", justifyContent: "center" },
  secondaryText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: bk.text,
    textDecorationLine: "underline",
  },
})
