import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import { ServiceTileIcon } from "@/components/home/ServiceTileIcon"
import { ui } from "@/components/salon-page/theme"
import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { LocationEmptyKind } from "@/lib/explore-location"
import { getServiceTile, type ServiceTileKey } from "@/lib/service-tiles"
import { fontFamily } from "@/theme/tokens"

type LocationProps = {
  variant?: "location"
  kind: Exclude<LocationEmptyKind, "none">
  cityLabel?: string | null
  onBrowseCity?: () => void
  onChangeLocation: () => void
  /** Solo artists are listed just above: a short note instead of the full "expanding soon" card. */
  artistsShown?: boolean
  onClearFilters?: never
  onRetry?: never
  message?: never
}

type FilterProps = {
  variant: "filters"
  kind?: never
  cityLabel?: never
  onBrowseCity?: never
  onChangeLocation?: never
  onClearFilters: () => void
  onRetry?: never
  message?: never
}

type NetworkProps = {
  variant: "network"
  kind?: never
  cityLabel?: never
  onBrowseCity?: never
  onChangeLocation?: never
  onClearFilters?: never
  onRetry: () => void
  message?: string
}

type Props = LocationProps | FilterProps | NetworkProps

const PEACH: [string, string] = ["#fff4ef", "#ffe1d6"]
const SKY: [string, string] = ["#f1f8fe", "#d9ebfb"]
const LAVENDER: [string, string] = ["#f7f2ff", "#e6dcff"]

/** Three overlapping pastel circles, each with a service tile icon. */
function TileCluster({ keys }: { keys: [ServiceTileKey, ServiceTileKey, ServiceTileKey] }) {
  const tiles = keys.map((key) => getServiceTile(key)).filter((tile) => tile != null)
  return (
    <View style={styles.cluster} accessible={false} importantForAccessibility="no-hide-descendants">
      {tiles.map((tile, index) => {
        const big = index === 1
        const size = big ? 76 : 60
        return (
          <View
            key={tile.key}
            style={[
              styles.circle,
              { width: size, height: size, borderRadius: size / 2, zIndex: big ? 2 : 1 },
              index === 0 && styles.circleLeft,
              index === 2 && styles.circleRight,
            ]}
          >
            <GradientFill colors={tile.gradient} angle={150} radius={size / 2} />
            <ServiceTileIcon tile={tile} size={big ? 36 : 28} />
          </View>
        )
      })}
    </View>
  )
}

/** One white circle with an icon, for the filters / network states. */
function IconBadge({ icon }: { icon: IconName }) {
  return (
    <View style={styles.badge} importantForAccessibility="no-hide-descendants">
      <Icon name={icon} size={28} color="#111111" />
    </View>
  )
}

function Pill({ label, onPress, outline }: { label: string; onPress: () => void; outline?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pill, outline ? styles.pillOutline : styles.pillSolid, pressed && ui.pressed]}
    >
      <Text style={[styles.pillText, outline && styles.pillTextOutline]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

function Card({
  colors,
  art,
  title,
  body,
  children,
}: {
  colors: [string, string]
  art: ReactNode
  title: string
  body: string
  children: ReactNode
}) {
  return (
    <View style={styles.wrap}>
      <GradientFill colors={colors} angle={150} radius={20} />
      {art}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.actions}>{children}</View>
    </View>
  )
}

export function LocationEmptyState(props: Props) {
  if (props.variant === "network") {
    return (
      <Card
        colors={SKY}
        art={<IconBadge icon="cloud-offline-outline" />}
        title="Couldn't load salons"
        body={props.message ?? "Check your connection and try again."}
      >
        <Pill label="Try again" onPress={props.onRetry} />
      </Card>
    )
  }

  if (props.variant === "filters") {
    return (
      <Card
        colors={LAVENDER}
        art={<IconBadge icon="options-outline" />}
        title="No places found"
        body="Try another category or clear your filters and search."
      >
        <Pill label="Clear filters" onPress={props.onClearFilters} />
      </Card>
    )
  }

  const { kind, cityLabel, onBrowseCity, onChangeLocation, artistsShown } = props
  const nearbyWithCity = kind === "nearby_city_available" && Boolean(cityLabel)

  if (artistsShown) {
    return (
      <View style={styles.note}>
        <View style={styles.noteHead}>
          <View style={styles.noteIcon}>
            <Icon name="storefront-outline" size={18} color="#3b2a24" />
          </View>
          <View style={styles.noteCopy}>
            <Text style={styles.noteTitle}>No salons {cityLabel ? `in ${cityLabel} ` : "here "}yet</Text>
            <Text style={styles.noteBody}>
              {nearbyWithCity
                ? `You can book a solo artist above, or browse salons across ${cityLabel}.`
                : "You can book a solo artist above, or choose another location for salons."}
            </Text>
          </View>
        </View>
        <View style={styles.noteActions}>
          {nearbyWithCity && onBrowseCity ? (
            <View style={styles.noteButton}>
              <Pill label={`Browse ${cityLabel}`} onPress={onBrowseCity} outline />
            </View>
          ) : null}
          <View style={styles.noteButton}>
            <Pill label="Change location" onPress={onChangeLocation} outline />
          </View>
        </View>
      </View>
    )
  }

  return (
    <Card
      colors={PEACH}
      art={<TileCluster keys={["haircut", "facial", "nails"]} />}
      title="We're expanding in your city soon."
      body={
        nearbyWithCity
          ? `No salons within your nearby radius yet. Browse ${cityLabel} for more places, or shift the pin to a busier neighbourhood.`
          : "Glammzo is still expanding here. Switch to a city we already serve so you can discover salons and book right away."
      }
    >
      {nearbyWithCity && onBrowseCity ? (
        <>
          <Pill label={`Browse ${cityLabel}`} onPress={onBrowseCity} />
          <Pill label="Change location" onPress={onChangeLocation} outline />
        </>
      ) : (
        <Pill label="Choose another location" onPress={onChangeLocation} />
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
  },
  cluster: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 84,
    marginBottom: 18,
  },
  circle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  circleLeft: { marginRight: -12, marginTop: 14 },
  circleRight: { marginLeft: -12, marginTop: 14 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
    color: "#111111",
    textAlign: "center",
  },
  body: {
    marginTop: 6,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: "#595959",
    textAlign: "center",
    maxWidth: 320,
  },
  actions: {
    width: "100%",
    maxWidth: 320,
    gap: 8,
    marginTop: 20,
  },
  pill: {
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  pillSolid: { backgroundColor: "#111111" },
  pillOutline: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e3e3e3" },
  pillText: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: "#ffffff" },
  pillTextOutline: { color: "#111111" },
  note: {
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    backgroundColor: "#ffffff",
    gap: 12,
  },
  noteHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  noteIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ffe1d6",
    alignItems: "center",
    justifyContent: "center",
  },
  noteCopy: { flex: 1, minWidth: 0, gap: 2 },
  noteTitle: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: "#111111" },
  noteBody: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: "#595959" },
  noteActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  noteButton: { flexGrow: 1, flexBasis: 140 },
})
