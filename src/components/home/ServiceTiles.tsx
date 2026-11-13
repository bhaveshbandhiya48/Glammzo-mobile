import { Pressable, StyleSheet, View } from "react-native"

import { AudienceSwitch } from "@/components/home/AudienceSwitch"
import { AllServicesIcon, ServiceTileIcon } from "@/components/home/ServiceTileIcon"
import { GradientFill } from "@/components/home/GradientFill"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"
import { SERVICE_TILES, homeTiles, type HomeAudience, type ServiceTile } from "@/lib/service-tiles"

const TILE = 72

export function ServiceTileButton({
  tile,
  onPress,
}: {
  tile: ServiceTile
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tile.label}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
    >
      <View style={styles.squircle}>
        <GradientFill colors={tile.gradient} angle={150} radius={24} />
        <ServiceTileIcon tile={tile} size={32} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {tile.label}
      </Text>
    </Pressable>
  )
}

function AllServicesButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="All services"
      onPress={onPress}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
    >
      <View style={[styles.squircle, styles.allBg]}>
        <AllServicesIcon size={28} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        All services
      </Text>
    </Pressable>
  )
}

/** "BOOK A SERVICE": Women/Men switch, 7 tiles for the audience plus "All services", 4 per row. */
export function ServiceTilesSection({
  audience,
  onAudienceChange,
  onPressTile,
  onSeeAll,
}: {
  audience: HomeAudience
  onAudienceChange: (next: HomeAudience) => void
  onPressTile: (tile: ServiceTile) => void
  onSeeAll: () => void
}) {
  const tiles = homeTiles(audience)
  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <Text style={styles.sectionLabel}>BOOK A SERVICE</Text>
        <AudienceSwitch value={audience} onChange={onAudienceChange} />
      </View>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <ServiceTileButton key={tile.key} tile={tile} onPress={() => onPressTile(tile)} />
        ))}
        <AllServicesButton onPress={onSeeAll} />
      </View>
    </View>
  )
}

/** Sheet with all 12 tiles. */
export function AllServicesSheet({
  visible,
  onClose,
  onPressTile,
}: {
  visible: boolean
  onClose: () => void
  onPressTile: (tile: ServiceTile) => void
}) {
  return (
    <BottomSheet visible={visible} title="All services" onClose={onClose}>
      <View style={[styles.grid, styles.sheetGrid]}>
        {SERVICE_TILES.map((tile) => (
          <ServiceTileButton
            key={tile.key}
            tile={tile}
            onPress={() => {
              onClose()
              onPressTile(tile)
            }}
          />
        ))}
      </View>
    </BottomSheet>
  )
}

/** Small uppercase section label with an optional "See all". */
export function SectionLabel({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
      {onSeeAll ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See all: ${title}`}
          onPress={onSeeAll}
          hitSlop={8}
        >
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    letterSpacing: 2,
    color: "#4b5563",
  },
  seeAll: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: "#111111",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 20,
  },
  sheetGrid: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  cell: {
    width: "25%",
    alignItems: "center",
    gap: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  squircle: {
    width: TILE,
    height: TILE,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  allBg: {
    backgroundColor: "#f6f6f7",
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 17,
    color: "#111111",
  },
})
