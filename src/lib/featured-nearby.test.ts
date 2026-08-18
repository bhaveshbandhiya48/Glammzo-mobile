import { describe, expect, it } from "vitest"

import { pickFeaturedSectionSalons, pickNearbyAfterFeatured } from "@/lib/featured-nearby"
import type { Salon } from "@/data/types"

function salon(
  id: string,
  opts: { featured?: boolean; distanceKm?: number } = {},
): Salon {
  return {
    id,
    name: id,
    area: "Area",
    city: "City",
    address: "",
    rating: 4.5,
    reviewCount: 10,
    priceFrom: 499,
    imageUrl: "https://example.com/s.jpg",
    isOpenNow: true,
    isFeatured: opts.featured ?? false,
    distanceKm: opts.distanceKm,
  } as Salon
}

describe("featured-nearby", () => {
  it("prefers featured salons nearest-first", () => {
    const result = pickFeaturedSectionSalons([
      salon("a", { featured: true, distanceKm: 2 }),
      salon("b", { featured: false, distanceKm: 0.5 }),
      salon("c", { featured: true, distanceKm: 1 }),
    ])
    expect(result.usedNearbyFallback).toBe(false)
    expect(result.salons.map((item) => item.id)).toEqual(["c", "a"])
  })

  it("returns empty when no salon is marked featured", () => {
    const result = pickFeaturedSectionSalons([
      salon("a", { distanceKm: 2 }),
      salon("b", { distanceKm: 0.5 }),
      salon("c", { distanceKm: 1 }),
    ])
    expect(result.usedNearbyFallback).toBe(false)
    expect(result.salons).toEqual([])
  })

  it("nearby excludes featured ids but keeps closer local salons", () => {
    const featured = [
      salon("f1", { featured: true, distanceKm: 0.4 }),
      salon("f2", { featured: true, distanceKm: 1 }),
    ]
    const nearby = pickNearbyAfterFeatured(
      [
        ...featured,
        salon("n1", { distanceKm: 0.8 }),
        salon("n2", { distanceKm: 1.2 }),
        salon("n3", { distanceKm: 3 }),
      ],
      featured,
    )
    expect(nearby.map((item) => item.id)).toEqual(["n1", "n2", "n3"])
  })
})
