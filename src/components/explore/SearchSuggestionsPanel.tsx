import { useEffect, useRef, useState } from "react"
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Salon } from "@/data/types"
import type { SearchSuggestions } from "@/lib/search-suggestions"
import { colors, radii, spacing, typography } from "@/theme/tokens"

type Props = {
  visible: boolean
  initialQuery: string
  suggestions: SearchSuggestions
  popularSearches: string[]
  onQueryChange: (query: string) => void
  onPickQuery: (query: string) => void
  onPickSalon: (salonId: string) => void
  onClose: () => void
}

export function SearchSuggestionsPanel({
  visible,
  initialQuery,
  suggestions,
  popularSearches,
  onQueryChange,
  onPickQuery,
  onPickSalon,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets()
  const inputRef = useRef<TextInputInstance>(null)
  const [draft, setDraft] = useState(initialQuery)

  useEffect(() => {
    if (!visible) return
    setDraft(initialQuery)
    onQueryChange(initialQuery)
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(t)
    // Only re-sync when the screen opens, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  function updateDraft(value: string) {
    setDraft(value)
    onQueryChange(value)
  }

  function close() {
    inputRef.current?.blur()
    onClose()
  }

  function submit() {
    const next = draft.trim()
    if (next) onPickQuery(next)
    else close()
  }

  const trimmed = draft.trim()
  const hasResults =
    suggestions.salons.length > 0 ||
    suggestions.services.length > 0 ||
    suggestions.categories.length > 0

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={close}
    >
      <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.header}>
          <Pressable
            onPress={close}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Icon name="chevron-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.search}>
            <Icon name="search-outline" size={18} color={colors.textSubtle} />
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={updateDraft}
              placeholder="Search salons, spa, barber…"
              placeholderTextColor={colors.textSubtle}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="never"
              onSubmitEditing={submit}
              accessibilityLabel="Search salons"
            />
            {draft.length > 0 ? (
              <Pressable
                onPress={() => updateDraft("")}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Icon name="close-circle" size={18} color={colors.textSubtle} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + spacing.xxl },
          ]}
        >
          {!trimmed ? (
            popularSearches.length > 0 ? (
              <>
                <Text variant="label" muted style={styles.sectionLabel}>
                  Popular searches
                </Text>
                {popularSearches.map((item) => (
                  <SuggestionRow
                    key={item}
                    icon="search-outline"
                    title={item}
                    onPress={() => onPickQuery(item)}
                  />
                ))}
              </>
            ) : (
              <View style={styles.empty}>
                <Text variant="bodyStrong">Search salons & services</Text>
                <Text muted>Try a salon name, service, or area.</Text>
              </View>
            )
          ) : !hasResults ? (
            <View style={styles.empty}>
              <Text variant="bodyStrong">No matches</Text>
              <Text muted>Try a salon name, service, or area.</Text>
            </View>
          ) : (
            <>
              {suggestions.categories.length > 0 ? (
                <>
                  <Text variant="label" muted style={styles.sectionLabel}>
                    Categories
                  </Text>
                  {suggestions.categories.map((cat) => (
                    <SuggestionRow
                      key={cat.id}
                      icon="grid-outline"
                      title={cat.label}
                      onPress={() => onPickQuery(cat.label)}
                    />
                  ))}
                </>
              ) : null}

              {suggestions.salons.length > 0 ? (
                <>
                  <Text variant="label" muted style={styles.sectionLabel}>
                    Salons
                  </Text>
                  {suggestions.salons.map((salon: Salon) => (
                    <SuggestionRow
                      key={salon.id}
                      icon="storefront-outline"
                      title={salon.name}
                      subtitle={`${salon.area} · ${salon.businessType ?? "Salon"}`}
                      onPress={() => onPickSalon(salon.id)}
                    />
                  ))}
                </>
              ) : null}

              {suggestions.services.length > 0 ? (
                <>
                  <Text variant="label" muted style={styles.sectionLabel}>
                    Services
                  </Text>
                  {suggestions.services.map((svc, index) => (
                    <SuggestionRow
                      key={`${svc.salonId}-${svc.id}-${index}`}
                      icon="cut-outline"
                      title={svc.name}
                      subtitle={`${svc.salonName} · ₹${svc.price}`}
                      onPress={() => onPickSalon(svc.salonId)}
                    />
                  ))}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

function SuggestionRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: "search-outline" | "grid-outline" | "storefront-outline" | "cut-outline"
  title: string
  subtitle?: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Icon name={icon} size={18} color={colors.textMuted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" muted numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-forward" size={16} color={colors.textSubtle} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 0,
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
  },
  scroll: {
    paddingTop: spacing.sm,
  },
  sectionLabel: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.88,
    backgroundColor: colors.muted,
  },
})
