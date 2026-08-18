import { Image, StyleSheet, View } from "react-native"

import { Button } from "@/components/ui/Button"
import { Text } from "@/components/ui/Text"
import type { LocationEmptyKind } from "@/lib/explore-location"
import { colors, radii, spacing } from "@/theme/tokens"

const EMPTY_MASCOT = require("../../../assets/brand/glammzo-mascot-empty.png")

type LocationProps = {
  variant?: "location"
  kind: Exclude<LocationEmptyKind, "none">
  cityLabel?: string | null
  onBrowseCity?: () => void
  onChangeLocation: () => void
  onClearFilters?: never
}

type FilterProps = {
  variant: "filters"
  kind?: never
  cityLabel?: never
  onBrowseCity?: never
  onChangeLocation?: never
  onClearFilters: () => void
}

type Props = LocationProps | FilterProps

export function LocationEmptyState(props: Props) {
  if (props.variant === "filters") {
    return (
      <View style={styles.wrap}>
        <Image
          source={EMPTY_MASCOT}
          style={styles.mascot}
          resizeMode="contain"
          accessibilityLabel="Glammzo mascot"
        />

        <Text variant="heading" style={styles.title}>
          No places found
        </Text>

        <Text muted style={styles.body}>
          Try another category or clear your filters and search.
        </Text>

        <View style={styles.actions}>
          <Button label="Clear filters" onPress={props.onClearFilters} />
        </View>
      </View>
    )
  }

  const { kind, cityLabel, onBrowseCity, onChangeLocation } = props
  const nearbyWithCity = kind === "nearby_city_available" && Boolean(cityLabel)

  return (
    <View style={styles.wrap}>
      <Image
        source={EMPTY_MASCOT}
        style={styles.mascot}
        resizeMode="contain"
        accessibilityLabel="Glammzo mascot"
      />

      <Text variant="heading" style={styles.title}>
        We&apos;re expanding in your city soon.
      </Text>

      <Text muted style={styles.body}>
        {nearbyWithCity
          ? `No salons within your nearby radius yet. Browse ${cityLabel} for more places, or shift the pin to a busier neighbourhood.`
          : "Glammzo is still expanding here. Switch to a city we already serve so you can discover salons and book right away."}
      </Text>

      <View style={styles.actions}>
        {nearbyWithCity && onBrowseCity ? (
          <>
            <Button label={`Browse ${cityLabel}`} onPress={onBrowseCity} />
            <Button
              label="Change location"
              variant="secondary"
              onPress={onChangeLocation}
            />
          </>
        ) : (
          <Button label="Choose another location" onPress={onChangeLocation} />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  mascot: {
    width: 168,
    height: 168,
    marginBottom: spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  body: {
    textAlign: "center",
    maxWidth: 320,
    marginBottom: spacing.xl,
  },
  actions: {
    width: "100%",
    maxWidth: 320,
    gap: spacing.sm,
  },
})
