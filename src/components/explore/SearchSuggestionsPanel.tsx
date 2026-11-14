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

import { GradientFill } from "@/components/home/GradientFill"
import { SEE_ALL_EMPTY_COLORS, SeeAllEmpty } from "@/components/list/SeeAllParts"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { Salon } from "@/data/types"
import type { SearchSuggestions } from "@/lib/search-suggestions"
import { fontFamily } from "@/theme/tokens"

type RowIcon = "search-outline" | "grid-outline" | "storefront-outline" | "cut-outline"

/** Pastel icon square per suggestion kind. */
const TINTS: Record<RowIcon, { bg: string; ink: string }> = {
  "search-outline": { bg: "#fff1ea", ink: "#3b2a24" },
  "grid-outline": { bg: "#f3eeff", ink: "#2e2447" },
  "storefront-outline": { bg: "#eaf4fd", ink: "#1f3446" },
  "cut-outline": { bg: "#ecf7ef", ink: "#1f3a2a" },
}

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
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <GradientFill colors={["#fdf3ee", "#ffffff"]} angle={180} />
          <Pressable
            onPress={close}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Icon name="chevron-back" size={20} color="#111111" />
          </Pressable>

          <View style={styles.search}>
            <Icon name="search-outline" size={18} color="#595959" />
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={updateDraft}
              placeholder="Search salons, spa, barber…"
              placeholderTextColor="#8a8a8a"
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
                <Icon name="close-circle" size={18} color="#8a8a8a" />
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
            { paddingBottom: insets.bottom + 40 },
          ]}
        >
          {!trimmed ? (
            popularSearches.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>
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
              <SeeAllEmpty
                icon="search-outline"
                colors={SEE_ALL_EMPTY_COLORS.salons}
                title="Search salons & services"
                body="Try a salon name, service, or area."
              />
            )
          ) : !hasResults ? (
            <SeeAllEmpty
              icon="search-outline"
              colors={SEE_ALL_EMPTY_COLORS.error}
              title="No matches"
              body="Try a salon name, service, or area."
              actionLabel={`Search “${trimmed}” anyway`}
              onAction={submit}
            />
          ) : (
            <>
              {suggestions.categories.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>
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
                  <Text style={styles.sectionLabel}>
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
                  <Text style={styles.sectionLabel}>
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
  icon: RowIcon
  title: string
  subtitle?: string
  onPress: () => void
}) {
  const tint = TINTS[icon]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tint.bg }]}>
        <Icon name={icon} size={18} color={tint.ink} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-forward" size={16} color="#8a8a8a" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flex: 1,
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
    height: 46,
    paddingVertical: 0,
    fontSize: 15,
    fontFamily: fontFamily.regular,
    color: "#111111",
  },
  scroll: {
    paddingTop: 4,
  },
  sectionLabel: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#4b5563",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 56,
  },
  rowPressed: {
    backgroundColor: "#f6f6f6",
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: "#111111",
  },
  rowSub: {
    marginTop: 1,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#595959",
  },
  pressed: {
    opacity: 0.7,
  },
})
