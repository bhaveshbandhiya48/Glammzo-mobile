import { useCallback, useEffect, useMemo, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router"

import { Button } from "@/components/ui/Button"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Icon } from "@/components/ui/Icon"
import { Screen } from "@/components/ui/Screen"
import { SalonCard } from "@/components/ui/SalonCard"
import { ExploreSalonsSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { isBusinessType, type BusinessType } from "@/data/business-types"
import type { Salon } from "@/data/types"
import {
  salonsInSelectedLocation,
  withSalonDistanceFromLocation,
} from "@/lib/explore-location"
import {
  EXPLORE_SORT_FILTERS,
  sortExploreSalons,
  type ExploreSortId,
} from "@/lib/explore-filters"
import { fetchSalons, getCatalogSnapshot } from "@/lib/salons-api"
import { bootstrapLaunchPermissions } from "@/lib/launch-permissions"
import {
  DEFAULT_SAVED_LOCATION,
  getSavedLocation,
  type SavedLocation,
} from "@/lib/user"
import { colors, radii, spacing } from "@/theme/tokens"

function salonsForCategory(
  catalog: Salon[],
  location: SavedLocation | null,
  category: BusinessType,
): Salon[] {
  return salonsInSelectedLocation(catalog, location, "nearby")
    .filter((salon) => salon.businessType?.trim() === category)
    .map((salon) => withSalonDistanceFromLocation(salon, location))
}

export default function CategorySalonsScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const { type } = useLocalSearchParams<{ type?: string }>()
  const category = typeof type === "string" && isBusinessType(type) ? type : null

  useEffect(() => {
    navigation.setOptions({ title: category ?? "Category" })
  }, [category, navigation])

  const [loading, setLoading] = useState(true)
  const [location, setLocation] = useState<SavedLocation | null>(null)
  const [catalog, setCatalog] = useState<Salon[]>(() => getCatalogSnapshot())
  const [sort, setSort] = useState<ExploreSortId>("nearest")
  const [sortOpen, setSortOpen] = useState(false)

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
          setCatalog(cached)
          setLoading(false)
        } else {
          setLoading(true)
        }

        try {
          const { salons } = await fetchSalons()
          if (!active) return
          setCatalog(salons)
        } catch {
          if (!active) return
          const fallback = getCatalogSnapshot()
          if (fallback.length > 0) setCatalog(fallback)
        } finally {
          if (active) setLoading(false)
        }
      })()

      return () => {
        active = false
      }
    }, []),
  )

  const salons = useMemo(() => {
    if (!category) return []
    return sortExploreSalons(salonsForCategory(catalog, location, category), sort)
  }, [catalog, category, location, sort])

  const sortLabel =
    EXPLORE_SORT_FILTERS.find((item) => item.id === sort)?.label ?? "Nearest"

  const locationLabel =
    location?.area?.trim() ||
    location?.city?.trim() ||
    location?.label?.trim() ||
    "Locating…"

  if (!category) {
    return (
      <Screen scroll>
        <Text variant="title">Category not found</Text>
        <Text muted style={styles.gap}>
          That business type isn’t available.
        </Text>
        <Button
          label="Browse categories"
          style={{ marginTop: spacing.xl }}
          onPress={() => router.replace("/services")}
        />
      </Screen>
    )
  }

  return (
    <Screen scroll>
      <Text muted>
        {salons.length} {salons.length === 1 ? "place" : "places"} near {locationLabel}
      </Text>

      <View style={styles.toolbar}>
        <Pressable
          style={styles.sortChip}
          onPress={() => setSortOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${sortLabel}`}
        >
          <Icon name="swap-vertical-outline" size={16} color={colors.text} />
          <Text variant="caption" numberOfLines={1}>
            {sortLabel}
          </Text>
          <Icon name="chevron-down" size={14} color={colors.textSubtle} />
        </Pressable>
      </View>

      {loading && salons.length === 0 ? (
        <View style={styles.list}>
          <ExploreSalonsSkeleton count={3} />
        </View>
      ) : salons.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyStrong">No places nearby</Text>
          <Text muted>
            We couldn’t find {category.toLowerCase()} places near {locationLabel}.
          </Text>
          <Button
            label="Browse categories"
            style={{ marginTop: spacing.lg }}
            onPress={() => router.back()}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {salons.map((salon) => (
            <SalonCard
              key={salon.id}
              salon={salon}
              layout="list"
              onPress={() =>
                router.push({ pathname: "/salon/[id]", params: { id: salon.id } })
              }
            />
          ))}
        </View>
      )}

      <BottomSheet
        visible={sortOpen}
        title="Sort by"
        onClose={() => setSortOpen(false)}
      >
        {EXPLORE_SORT_FILTERS.map((item) => {
          const active = sort === item.id
          return (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              style={styles.sortRow}
              onPress={() => {
                setSort(item.id)
                setSortOpen(false)
              }}
            >
              <Text color={active ? colors.primary : colors.text}>{item.label}</Text>
              {active ? (
                <Icon name="checkmark" size={18} color={colors.primary} />
              ) : null}
            </Pressable>
          )
        })}
      </BottomSheet>
    </Screen>
  )
}

const styles = StyleSheet.create({
  gap: {
    marginTop: spacing.sm,
  },
  toolbar: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  list: {
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  empty: {
    marginTop: spacing.xxxl,
    gap: spacing.sm,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
})
