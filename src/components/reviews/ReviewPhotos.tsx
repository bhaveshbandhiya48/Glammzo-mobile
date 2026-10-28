import { Image } from "expo-image"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { SalonGalleryLightbox } from "@/components/salon/SalonGalleryLightbox"
import { radii, spacing } from "@/theme/tokens"

/** Small photo row under a review; tap opens them full screen. */
export function ReviewPhotos({ urls, title }: { urls?: string[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!urls?.length) return null
  return (
    <View style={styles.row}>
      {urls.map((url, index) => (
        <Pressable
          key={url}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Review photo ${index + 1} of ${urls.length}. Open full screen.`}
          onPress={() => setOpen(index)}
        >
          <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" />
        </Pressable>
      ))}
      <SalonGalleryLightbox
        visible={open != null}
        gallery={urls}
        salonName={title}
        index={open ?? 0}
        onClose={() => setOpen(null)}
        onIndexChange={setOpen}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
  },
})
