import { Image, type ImageProps } from "expo-image"
import { useEffect, useState } from "react"

import { optimizedImageUrl } from "@/lib/image-url"

type Props = Omit<ImageProps, "source"> & {
  uri: string
  /** Width the photo is drawn at, in dp; picks the download size. */
  displayWidth: number
}

/**
 * Salon / artist photo loaded at the size it is shown, not the full upload.
 * Falls back to the original URL once if the resized copy fails.
 */
export function RemoteImage({ uri, displayWidth, onError, ...rest }: Props) {
  const optimized = optimizedImageUrl(uri, displayWidth) ?? uri
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [optimized])

  return (
    <Image
      cachePolicy="memory-disk"
      recyclingKey={uri}
      {...rest}
      source={{ uri: failed ? uri : optimized }}
      onError={(event) => {
        if (!failed && optimized !== uri) {
          setFailed(true)
          return
        }
        onError?.(event)
      }}
    />
  )
}
