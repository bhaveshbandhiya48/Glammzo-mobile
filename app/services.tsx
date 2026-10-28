import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Screen } from "@/components/ui/Screen"
import { Text } from "@/components/ui/Text"
import {
  BUSINESS_TYPE_ITEMS,
  countSalonsByBusinessType,
  type BusinessType,
} from "@/data/business-types"
import type { Salon } from "@/data/types"
import { salonsInSelectedLocation } from "@/lib/explore-location"
import { fetchSalons, getCatalogSnapshot } from "@/lib/salons-api"
import { bootstrapLaunchPermissions } from "@/lib/launch-permissions"
import {
  DEFAULT_SAVED_LOCATION,
  getSavedLocation,
  type SavedLocation,
} from "@/lib/user"
import { colors, radii, spacing } from "@/theme/tokens"

function countsForLocation(catalog: Salon[], location: SavedLocation | null) {
  // Match Explore's default nearby scope so categories don't appear without places.
  return countSalonsByBusinessType(
    salonsInSelectedLocation(catalog, location, "nearby"),
  )
}

export default function ServicesScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [location, setLocation] = useState<SavedLocation | null>(null)
  const [counts, setCounts] = useState<Map<BusinessType, number>>(
    () => countsForLocation(getCatalogSnapshot(), DEFAULT_SAVED_LOCATION),
  )

  useFocusEffect(
    useCallback(() => {
      let active = true

      void (async () => {
        await bootstrapLaunchPermissions()
        const saved = (await getSavedLocation()) ?? DEFAULT_SAVED_LOCATION
        if (!active) return
        setLocation(saved)

        const cached = getCatalogSnapshot()
        if (cached.length > 0) {
          setCounts(countsForLocation(cached, saved))
          setLoading(false)
        } else {
          setLoading(true)
        }

        try {
          const { salons } = await fetchSalons()
          if (!active) return
          setCounts(countsForLocation(salons, saved))
        } catch {
          if (!active) return
          setCounts(countsForLocation(getCatalogSnapshot(), saved))
        } finally {
          if (active) setLoading(false)
        }
      })()

      return () => {
        active = false
      }
    }, []),
  )

  const locationLabel =
    location?.area?.trim() ||
    location?.city?.trim() ||
    location?.label?.trim() ||
    "Locating…"

  const availableTypes = useMemo(
    () =>
      BUSINESS_TYPE_ITEMS.filter((item) => (counts.get(item.label) ?? 0) > 0).map(
        (item) => ({
          ...item,
          count: counts.get(item.label) ?? 0,
        }),
      ),
    [counts],
  )

  function openCategory(type: BusinessType) {
    router.push({
      pathname: "/category/[type]",
      params: { type },
    })
  }

  return (
    <Screen scroll>
      <Text variant="title">Services</Text>
      <Text muted style={styles.gap}>
        Categories near {locationLabel}.
      </Text>

      {loading && availableTypes.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : availableTypes.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyStrong">No categories nearby</Text>
          <Text muted>
            We couldn’t find places for this location yet. Try another area from Explore.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {availableTypes.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.label}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => openCategory(item.label)}
            >
              <View style={styles.iconWrap}>
                <Icon name={item.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.copy}>
                <Text variant="bodyStrong">{item.label}</Text>
                <Text variant="caption" muted>
                  {item.count} {item.count === 1 ? "place" : "places"} near you
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textSubtle} />
            </Pressable>
          ))}
        </View>
      )}

      <Button
        label="Explore all places"
        style={{ marginTop: spacing.xxl }}
        onPress={() => router.push("/(tabs)/explore")}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  gap: {
    marginTop: spacing.sm,
  },
  loading: {
    marginTop: spacing.xxxl,
    alignItems: "center",
  },
  empty: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  grid: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: "#F1F1F1",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
})
