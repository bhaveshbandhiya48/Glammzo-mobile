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

export function LocationEmptyState(props: Props) {
  if (props.variant === "network") {
    return (
      <View style={styles.wrap}>
        <Image
          source={EMPTY_MASCOT}
          style={styles.mascot}
          resizeMode="contain"
          accessibilityLabel="Glammzo mascot"
        />

        <Text variant="heading" style={styles.title}>
          Couldn&apos;t load salons
        </Text>

        <Text muted style={styles.body}>
          {props.message ?? "Check your connection and try again."}
        </Text>

        <View style={styles.actions}>
          <Button label="Try again" onPress={props.onRetry} />
        </View>
      </View>
    )
  }

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

  const { kind, cityLabel, onBrowseCity, onChangeLocation, artistsShown } = props
  const nearbyWithCity = kind === "nearby_city_available" && Boolean(cityLabel)

  if (artistsShown) {
    return (
      <View style={styles.note}>
        <Text variant="bodyStrong">No salons {cityLabel ? `in ${cityLabel} ` : "here "}yet</Text>
        <Text variant="caption" muted>
          {nearbyWithCity
            ? `You can book a solo artist above, or browse salons across ${cityLabel}.`
            : "You can book a solo artist above, or choose another location for salons."}
        </Text>
        <View style={styles.noteActions}>
          {nearbyWithCity && onBrowseCity ? (
            <Button label={`Browse ${cityLabel}`} variant="secondary" onPress={onBrowseCity} style={styles.noteButton} />
          ) : null}
          <Button label="Change location" variant="secondary" onPress={onChangeLocation} style={styles.noteButton} />
        </View>
      </View>
    )
  }

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
  note: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  noteActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  noteButton: {
    flexGrow: 1,
  },
})
