import { Stack, useRouter } from "expo-router"
import { useState, type ReactElement, type ReactNode } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GradientFill } from "@/components/home/GradientFill"
import { PastelIcon, type Pastel } from "@/components/profile/ProfileParts"
import { pastels, sp, ui } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

/** Header tints, one per Profile sub-screen (matches its tile on Profile). */
export const HEADER_TINTS = {
  wallet: "#e3f6ec",
  loyalty: "#fff1ec",
  saved: "#fff1f6",
  giftCards: "#f2ecff",
  help: "#eef2f7",
} as const

export const MUTED = "#8a8a8a"

/** Full-page shell: hides the stack header, draws the gradient header with back + title. */
export function ProfileSubScreen({
  title,
  subtitle,
  tint,
  hero,
  children,
  refreshControl,
  keyboard,
}: {
  title: string
  subtitle?: string | null
  tint: string
  hero?: ReactNode
  children: ReactNode
  refreshControl?: ReactElement<RefreshControlProps>
  keyboard?: boolean
}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/profile")
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={keyboard && Platform.OS === "ios" ? "padding" : undefined}
      enabled={!!keyboard}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={keyboard ? "interactive" : "none"}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <GradientFill colors={[tint, "#ffffff"]} angle={180} />
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={6}
              onPress={goBack}
              style={({ pressed }) => [styles.back, pressed && ui.pressed]}
            >
              <Icon name="chevron-back" size={20} color={sp.text} />
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
          {hero ? <View style={styles.hero}>{hero}</View> : null}
        </View>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

export function SectionLabel({ children, first }: { children: string; first?: boolean }) {
  return <Text style={[ui.sectionLabel, styles.sectionLabel, first && styles.sectionLabelFirst]}>{children}</Text>
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function ErrorCard({ title, text, onRetry }: { title: string; text: string; onRetry: () => void }) {
  return (
    <View style={[styles.card, styles.centerCard]}>
      <PastelIcon pastel={pastels.peach} name="alert-circle-outline" />
      <Text style={styles.centerTitle}>{title}</Text>
      <Text style={styles.centerText}>{text}</Text>
      <OutlinePill label="Try again" onPress={onRetry} />
    </View>
  )
}

export function EmptyState({
  pastel,
  icon,
  title,
  text,
  ctaLabel,
  onCta,
}: {
  pastel: Pastel
  icon: IconName
  title: string
  text?: string
  ctaLabel?: string
  onCta?: () => void
}) {
  return (
    <View style={[styles.card, styles.centerCard]}>
      <View style={styles.emptyCircle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <GradientFill colors={pastel.gradient} angle={150} />
        <Icon name={icon} size={30} color={pastel.ink} />
      </View>
      <Text style={styles.centerTitle}>{title}</Text>
      {text ? <Text style={styles.centerText}>{text}</Text> : null}
      {ctaLabel && onCta ? (
        <Pressable
          accessibilityRole="button"
          onPress={onCta}
          style={({ pressed }) => [ui.blackPill, styles.emptyCta, pressed && ui.pressed]}
        >
          <Text style={[ui.blackPillText, styles.emptyCtaText]}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export type PillTone = "green" | "peach" | "grey" | "red"

const PILL_TONES: Record<PillTone, { bg: string; fg: string }> = {
  green: { bg: "#e6f5ec", fg: "#17633e" },
  peach: { bg: "#fff1ec", fg: "#8a3524" },
  grey: { bg: "#f2f2f2", fg: "#595959" },
  red: { bg: "#fdecea", fg: "#c0392b" },
}

export function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
  const colors = PILL_TONES[tone]
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.pillText, { color: colors.fg }]}>{label}</Text>
    </View>
  )
}

/** 52-tall black pill: the screen's main action. */
export function PrimaryPill({
  label,
  onPress,
  loading,
  disabled,
  icon,
}: {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  icon?: IconName
}) {
  const off = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, off && styles.primaryOff, pressed && ui.pressed]}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color="#ffffff" /> : null}
          <Text style={styles.primaryText}>{label}</Text>
        </>
      )}
    </Pressable>
  )
}

export function OutlinePill({ label, onPress, icon }: { label: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.outline, pressed && ui.pressed]}
    >
      {icon ? <Icon name={icon} size={16} color={sp.text} /> : null}
      <Text style={styles.outlineText}>{label}</Text>
    </Pressable>
  )
}

/** Filter chip: active is black with white text, inactive is white with a grey border. */
export function Chip({
  label,
  active,
  onPress,
  style,
}: {
  label: string
  active: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [ui.chip, styles.chip, active && ui.chipActive, pressed && ui.pressed, style]}
    >
      <Text style={[ui.chipText, active && ui.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

/** Text field: 48 tall, radius 12, #fafafa fill, #111 border on focus. */
export function Field({
  label,
  hint,
  error,
  style,
  multiline,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { label?: string; hint?: string; error?: string | null }) {
  const [focused, setFocused] = useState(false)
  const showError = Boolean(error?.trim())
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={rest.accessibilityLabel ?? label?.replace(/\s*\(optional\)$/i, "")}
        accessibilityHint={showError ? (error ?? undefined) : hint}
        placeholderTextColor={MUTED}
        multiline={multiline}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          focused && styles.fieldFocused,
          showError && styles.fieldError,
          style,
        ]}
        {...rest}
      />
      {showError ? (
        <Text style={styles.fieldErrorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  )
}

/** "June 2026" from an ISO date; "Earlier" when it can't be read. */
export function monthLabel(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Earlier"
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  scrollContent: { flexGrow: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, color: sp.text },
  subtitle: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: sp.secondary },
  hero: { marginTop: 16 },
  body: { paddingHorizontal: 16 },
  sectionLabel: { marginTop: 24, marginBottom: 10, paddingHorizontal: 4 },
  sectionLabelFirst: { marginTop: 12 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 14,
  },
  centerCard: { marginTop: 16, alignItems: "center", paddingVertical: 28, gap: 10 },
  centerTitle: {
    textAlign: "center",
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 21,
    color: sp.text,
  },
  centerText: {
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.secondary,
    marginTop: -4,
  },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyCta: { marginTop: 6, height: 44, paddingHorizontal: 22 },
  emptyCtaText: { fontSize: 14, lineHeight: 18 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, flexShrink: 0 },
  pillText: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16 },
  primary: {
    height: 52,
    borderRadius: 999,
    backgroundColor: sp.text,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryOff: { opacity: 0.4 },
  primaryText: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 21, color: "#ffffff" },
  outline: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: sp.text,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  outlineText: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18, color: sp.text },
  chip: { height: 36, paddingHorizontal: 16 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 17, color: sp.text },
  field: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#fafafa",
    paddingHorizontal: 14,
    fontFamily: fontFamily.regular,
    fontSize: 16,
    color: sp.text,
  },
  fieldMultiline: { minHeight: 120, paddingTop: 12, paddingBottom: 12, textAlignVertical: "top" },
  fieldFocused: { borderColor: sp.text, backgroundColor: "#ffffff" },
  fieldError: { borderColor: "#c0392b", borderWidth: 1.5 },
  fieldErrorText: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, color: "#c0392b" },
  fieldHint: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: sp.secondary },
})
