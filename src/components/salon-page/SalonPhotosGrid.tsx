import { Image } from "expo-image"
import { Pressable, StyleSheet, View } from "react-native"

import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

import { sp } from "./theme"

const ROW = 90
const GAP = 8

/** One large tile (2fr, two rows) plus up to two small tiles; the last shows +N. */
export function SalonPhotosGrid({ photos, onOpen }: { photos: string[]; onOpen: (index: number) => void }) {
  const [first, ...rest] = photos
  if (!first) return null
  const small = rest.slice(0, 2)
  const more = photos.length - 1 - small.length

  return (
    <View style={styles.grid}>
      <Tile uri={first} index={0} total={photos.length} onOpen={onOpen} style={styles.big} />
      {small.length > 0 ? (
        <View style={styles.side}>
          {small.map((uri, i) => (
            <Tile
              key={`${uri}-${i}`}
              uri={uri}
              index={i + 1}
              total={photos.length}
              more={i === small.length - 1 && more > 0 ? more : 0}
              onOpen={onOpen}
              style={styles.small}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

function Tile({
  uri,
  index,
  total,
  more = 0,
  onOpen,
  style,
}: {
  uri: string
  index: number
  total: number
  more?: number
  onOpen: (index: number) => void
  style: object
}) {
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={more > 0 ? `Photo ${index + 1} of ${total}, ${more} more. Open full screen` : `Photo ${index + 1} of ${total}. Open full screen`}
      onPress={() => onOpen(index)}
      style={[styles.tile, style]}
    >
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      {more > 0 ? (
        <View style={styles.moreScrim}>
          <Text style={styles.moreText}>+{more}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  grid: {
    height: ROW * 2 + GAP,
    flexDirection: "row",
    gap: GAP,
    paddingHorizontal: sp.gutter,
  },
  big: {
    flex: 2,
  },
  side: {
    flex: 1,
    gap: GAP,
  },
  small: {
    flex: 1,
  },
  tile: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: sp.grey,
  },
  moreScrim: {
    position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
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
