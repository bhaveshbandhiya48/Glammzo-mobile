import { Pressable, StyleSheet, View } from "react-native"

import { sp } from "@/components/salon-page/theme"
import { Text } from "@/components/ui/Text"
import type { PublicArtistPortfolioItem } from "@/lib/artists-api"
import { fontFamily } from "@/theme/tokens"
import { RemoteImage } from "@/components/ui/RemoteImage"

const GAP = 8
const MAX_TILES = 9

/** 3-column rounded grid; the ninth tile shows +N when there are more. */
export function ArtistPortfolioGrid({
  items,
  width,
  onOpen,
}: {
  items: PublicArtistPortfolioItem[]
  /** Window width; the grid sits inside the page gutter. */
  width: number
  onOpen: (index: number) => void
}) {
  const shown = items.slice(0, MAX_TILES)
  const more = items.length - shown.length
  const tile = Math.floor((width - sp.gutter * 2 - GAP * 2) / 3)

  return (
    <View style={styles.grid}>
      {shown.map((item, index) => {
        const uri = item.thumbnailUrl || item.imageUrl
        const extra = index === shown.length - 1 && more > 0 ? more : 0
        return (
          <Pressable
            key={item.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={
              extra > 0
                ? `Portfolio photo ${index + 1} of ${items.length}, ${extra} more. Open full screen`
                : `Portfolio photo ${index + 1} of ${items.length}${item.caption ? `, ${item.caption}` : ""}. Open full screen`
            }
            onPress={() => onOpen(index)}
            style={({ pressed }) => [styles.tile, { width: tile, height: tile }, pressed && { opacity: 0.88 }]}
          >
            <RemoteImage uri={uri} displayWidth={tile} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            {extra > 0 ? (
              <View style={styles.moreScrim}>
                <Text style={styles.moreText}>+{extra}</Text>
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    paddingHorizontal: sp.gutter,
  },
  tile: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: sp.grey,
  },
  moreScrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(17,17,17,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 22,
    color: "#ffffff",
  },
})
