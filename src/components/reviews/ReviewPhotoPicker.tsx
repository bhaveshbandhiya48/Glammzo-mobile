import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"

import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { ApiError } from "@/lib/api"
import { MAX_REVIEW_PHOTOS, uploadReviewPhoto } from "@/lib/reviews-api"
import { colors, radii, spacing } from "@/theme/tokens"

type Props = {
  urls: string[]
  onChange: (urls: string[]) => void
  /** True while a photo is uploading, so the form can wait before submitting. */
  onBusyChange?: (busy: boolean) => void
}

/** Up to 3 photos, uploaded as soon as they are picked. */
export function ReviewPhotoPicker({ urls, onChange, onBusyChange }: Props) {
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const room = MAX_REVIEW_PHOTOS - urls.length - uploading

  async function pick() {
    setError(null)
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError("Allow photo access in Settings to add photos.")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, room),
      quality: 0.85,
    })
    if (result.canceled) return
    const picked = result.assets.slice(0, room)
    setUploading((n) => n + picked.length)
    onBusyChange?.(true)
    let next = urls
    for (const asset of picked) {
      try {
        const url = await uploadReviewPhoto(asset)
        next = [...next, url]
        onChange(next)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't upload a photo. Try again.")
      } finally {
        setUploading((n) => n - 1)
      }
    }
    onBusyChange?.(false)
  }

  return (
    <View style={styles.wrap}>
      <Text variant="label" muted>
        Photos (optional, up to {MAX_REVIEW_PHOTOS})
      </Text>
      <View style={styles.row}>
        {urls.map((url, index) => (
          <View key={url} style={styles.thumb}>
            <Image source={{ uri: url }} style={styles.image} contentFit="cover" accessible accessibilityLabel={`Photo ${index + 1}`} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              hitSlop={8}
              style={styles.remove}
              onPress={() => onChange(urls.filter((u) => u !== url))}
            >
              <Icon name="close" size={14} color={colors.primaryFg} />
            </Pressable>
          </View>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <View key={`up-${i}`} style={[styles.thumb, styles.placeholder]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ))}
        {room > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add photos"
            style={({ pressed }) => [styles.thumb, styles.add, pressed && styles.pressed]}
            onPress={() => void pick()}
          >
            <Icon name="camera-outline" size={22} color={colors.text} />
            <Text variant="caption">Add</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color={colors.destructive}>
          {error}
        </Text>
      ) : (
        <Text variant="caption" muted>
          Photos of your look help others choose. They show with your review.
        </Text>
      )}
    </View>
  )
}

const SIZE = 84

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  thumb: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  remove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  add: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  pressed: {
    backgroundColor: colors.muted,
  },
})
