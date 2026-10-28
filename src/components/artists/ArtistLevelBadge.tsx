import { StyleSheet, View } from "react-native"

import { Text } from "@/components/ui/Text"
import {
  ARTIST_LEVEL_BADGE,
  type ArtistLevelId,
} from "@/lib/artist-level"
import { colors } from "@/theme/tokens"

/**
 * Soft medal badge — matches CRM artist LevelBadge silhouette.
 * Same shape every level; fill color + step marks change.
 */
export function ArtistLevelBadge({
  level,
  size = 20,
  label,
}: {
  level: ArtistLevelId
  size?: number
  /** Optional text beside the medal (e.g. "Rising"). */
  label?: string | null
}) {
  const badge = ARTIST_LEVEL_BADGE[level]
  const ring = size
  const inner = size * 0.72
  const mark = Math.max(3, Math.round(size * 0.1))

  return (
    <View
      style={styles.wrap}
      accessibilityLabel={label ? `${label} level` : undefined}
    >
      <View
        style={[
          styles.ring,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderColor: badge.fill,
          },
        ]}
      >
        <View
          style={[
            styles.disc,
            {
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              backgroundColor: badge.fill,
            },
          ]}
        >
          <View style={styles.marks}>
            {badge.dots === 0 ? (
              <View
                style={[
                  styles.seed,
                  { width: mark, height: mark, backgroundColor: badge.ink },
                ]}
              />
            ) : (
              Array.from({ length: badge.dots }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.petal,
                    {
                      width: mark * 1.05,
                      height: mark * 1.05,
                      borderRadius: mark,
                      backgroundColor: badge.ink,
                    },
                  ]}
                />
              ))
            )}
          </View>
        </View>
      </View>
      {label ? (
        <Text variant="caption" muted numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  ring: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    backgroundColor: colors.card,
  },
  disc: {
    alignItems: "center",
    justifyContent: "center",
  },
  marks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  seed: { borderRadius: 99, opacity: 0.75 },
  petal: {},
})
