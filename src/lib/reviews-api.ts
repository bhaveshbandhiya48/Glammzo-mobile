import { ImageManipulator, SaveFormat } from "expo-image-manipulator"
import { Platform } from "react-native"

import { ApiError, apiFetch } from "@/lib/api"
import { API_URL, CRM_URL } from "@/lib/config"
import { getAccessToken } from "@/lib/session"

export const MAX_REVIEW_PHOTOS = 3

type PickedPhoto = { uri: string; width?: number; height?: number }

/** Shrink to 1600px on the long edge as JPEG so uploads stay small and quick. */
async function preparePhoto(photo: PickedPhoto): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(photo.uri)
    if (photo.width && photo.height && Math.max(photo.width, photo.height) > 1600) {
      context.resize(photo.width >= photo.height ? { width: 1600 } : { height: 1600 })
    }
    const rendered = await context.renderAsync()
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 })
    return saved.uri
  } catch {
    return photo.uri
  }
}

/** Uploads one review photo and returns its public URL. */
export async function uploadReviewPhoto(photo: PickedPhoto): Promise<string> {
  const uri = await preparePhoto(photo)
  const form = new FormData()
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob()
    form.append("file", blob, "review.jpg")
  } else {
    // React Native's FormData accepts a file descriptor object.
    form.append("file", { uri, name: "review.jpg", type: "image/jpeg" } as unknown as Blob)
  }
  const token = await getAccessToken()
  const response = await fetch(`${API_URL}/api/mobile/review-photos`, {
    method: "POST",
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  })
  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!response.ok || !data.url) {
    throw new ApiError(response.status, data.error || "Couldn't upload the photo.")
  }
  return data.url
}

export async function submitSalonReview(input: {
  appointmentId: string
  rating: number
  reviewType: string
  comment: string
  includeStaffReview?: boolean
  photoUrls?: string[]
}) {
  return apiFetch<{
    ok: boolean
    submitted?: boolean
    alreadyReviewed?: boolean
  }>("/api/mobile/reviews", {
    method: "POST",
    body: input,
  })
}

/** Solo-artist review via CRM public booking token. */
export async function submitArtistReview(input: {
  publicToken: string
  rating: number
  reviewType: string
  comment: string
  photoUrls?: string[]
}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(
      `${CRM_URL}/api/public/bookings/${encodeURIComponent(input.publicToken)}/review`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: input.rating,
          reviewType: input.reviewType,
          comment: input.comment,
          ...(input.photoUrls?.length ? { photoUrls: input.photoUrls } : {}),
        }),
        signal: controller.signal,
      },
    )
    const data = (await response.json().catch(() => ({}))) as {
      submitted?: boolean
      alreadyReviewed?: boolean
      error?: string
    }
    if (!response.ok) {
      throw new Error(data.error || `Could not submit review (${response.status})`)
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}
