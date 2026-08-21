import { useCallback, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"

import { Button } from "@/components/ui/Button"
import { Screen } from "@/components/ui/Screen"
import { SalonCard } from "@/components/ui/SalonCard"
import { ExploreSalonsSkeleton } from "@/components/ui/Skeleton"
import { Text } from "@/components/ui/Text"
import { useFavorites } from "@/context/FavoritesContext"
import type { Salon } from "@/data/types"
import { fetchSalons, getCatalogSnapshot } from "@/lib/salons-api"
import { colors, radii, spacing } from "@/theme/tokens"

export default function FavoritesScreen() {
  const router = useRouter()
  const { ids, refresh } = useFavorites()
  const [catalog, setCatalog] = useState<Salon[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      setLoading(true)
      void Promise.all([refresh(), fetchSalons()])
        .then(([, { salons }]) => {
          if (cancelled) return
          setCatalog(salons)
        })
        .catch(() => {
          if (cancelled) return
          setCatalog(getCatalogSnapshot())
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }, [refresh]),
  )

  const salons = catalog.filter((salon) => ids.includes(salon.id))

  return (
    <Screen scroll>
      <Text variant="title">Saved salons</Text>
      <Text muted style={styles.gap}>
        Favorites you can book again quickly.
      </Text>

      {loading ? (
        <View style={styles.list}>
          <ExploreSalonsSkeleton count={2} />
        </View>
      ) : salons.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyStrong">No saved salons yet</Text>
          <Text muted>Tap the heart on explore or salon pages to save places.</Text>
          <Button label="Explore" onPress={() => router.push("/(tabs)/explore")} />
        </View>
      ) : (
        <View style={styles.list}>
          {salons.map((salon) => (
            <SalonCard
              key={salon.id}
              salon={salon}
              onPress={() =>
                router.push({ pathname: "/salon/[id]", params: { id: salon.id } })
              }
            />
          ))}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  gap: {
    marginTop: spacing.sm,
  },
  empty: {
    marginTop: spacing.xxxl,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderStyle: "dashed",
    backgroundColor: colors.card,
  },
  list: {
    marginTop: spacing.xl,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.md,
  },
})
