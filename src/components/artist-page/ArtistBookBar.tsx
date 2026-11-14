import { Platform, Pressable, StyleSheet, View } from "react-native"

import { sp, ui } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

export const BOOK_BAR_HEIGHT = 64
export const BOOK_BAR_GAP = 24

type Props = {
  bottomInset: number
  itemCount: number
  totalLabel: string
  firstItemName?: string
  /** Shown when nothing is picked yet. */
  emptyLine: string
  onBook: () => void
  onClear: () => void
  /** Outline "Get quotes" pill; only passed while the Get quotes flag is on. */
  onGetQuotes?: () => void
}

/** Floating bag bar for the artist page: count and total, outline Get quotes, black Book pill. */
export function ArtistBookBar({
  bottomInset,
  itemCount,
  totalLabel,
  firstItemName,
  emptyLine,
  onBook,
  onClear,
  onGetQuotes,
}: Props) {
  const hasItems = itemCount > 0
  const itemWord = itemCount === 1 ? "service" : "services"

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: BOOK_BAR_GAP + bottomInset }]}>
      <View style={styles.bar}>
        {hasItems ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear bag"
            hitSlop={8}
            onPress={onClear}
            style={({ pressed }) => [styles.clear, pressed && ui.pressed]}
          >
            <Icon name="close" size={16} color={sp.text} />
          </Pressable>
        ) : null}
        <View style={styles.copy}>
          {hasItems ? (
            <>
              <Text style={styles.total}>{totalLabel}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {itemCount} {itemWord}
                {firstItemName ? ` · ${firstItemName}` : ""}
              </Text>
            </>
          ) : (
            <Text style={styles.sub} numberOfLines={2}>
              {emptyLine}
            </Text>
          )}
        </View>
        {onGetQuotes ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get quotes from artists"
            onPress={onGetQuotes}
            style={({ pressed }) => [styles.outline, pressed && ui.pressed]}
          >
            <Text style={styles.outlineText}>Get quotes</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            hasItems ? `Book, ${itemCount} ${itemWord}, ${totalLabel}` : "Book. Pick a service first"
          }
          onPress={onBook}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaText}>Book</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 25,
  },
  bar: {
    height: BOOK_BAR_HEIGHT,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: sp.border,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 8,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      default: { elevation: 10 },
    }),
  },
  clear: {
    width: 28,
    height: 28,
    marginLeft: -4,
    borderRadius: 14,
    backgroundColor: sp.grey,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  total: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 19,
    color: sp.text,
  },
  sub: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: sp.secondary,
  },
  outline: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: sp.text,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: sp.text,
  },
  cta: {
    height: 48,
    minWidth: 88,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: sp.text,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 19,
    color: "#ffffff",
  },
})
