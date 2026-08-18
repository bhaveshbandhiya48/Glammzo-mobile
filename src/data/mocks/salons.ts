import type { Salon, SalonAmenities, SalonReview } from "@/data/types"

const img = {
  luxe: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80",
  luxeCover: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=80",
  luxe2: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80",
  luxe3: "https://images.unsplash.com/photo-1633681926022-84c1035a52a5?w=800&q=80",
  luxe4: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=800&q=80",
  glow: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80",
  glowCover: "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1200&q=80",
  glow2: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&q=80",
  glow3: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
  glow4: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80",
  nail: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80",
  nailCover: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1200&q=80",
  nail2: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=800&q=80",
  nail3: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=800&q=80",
  nail4: "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=800&q=80",
}

const defaultAmenities: SalonAmenities = {
  categories: [
    {
      icon: "wifi-outline",
      name: "Essentials",
      visible: true,
      items: ["Free Wi‑Fi", "Air conditioning", "Restroom"],
    },
    {
      icon: "card-outline",
      name: "Payments",
      visible: true,
      items: ["UPI", "Cards accepted"],
    },
    {
      icon: "car-outline",
      name: "Parking",
      visible: true,
      items: ["Street parking"],
    },
    {
      icon: "cafe-outline",
      name: "Comfort",
      visible: true,
      items: ["Complimentary water", "Waiting area"],
    },
  ],
}

function reviewsFor(
  salonName: string,
  staffName: string,
  serviceName: string,
): SalonReview[] {
  return [
    {
      id: `${salonName}-r1`,
      authorName: "Ananya Shah",
      reviewType: "Overall experience",
      rating: 5,
      date: "12 Aug 2026",
      serviceName,
      staffMember: { name: staffName, role: "Specialist" },
      comment: "Clean space, on-time booking, and a really polished finish. Would book again.",
      verified: true,
      ownerReply: `Thank you, Ananya — glad you loved your visit to ${salonName}.`,
      ownerReplyDate: "13 Aug 2026",
    },
    {
      id: `${salonName}-r2`,
      authorName: "Rahul Mehta",
      reviewType: "Professionalism",
      rating: 4,
      date: "3 Aug 2026",
      serviceName,
      staffMember: { name: staffName, role: "Specialist" },
      comment: "Friendly team and clear pricing. Slight wait at peak hour but worth it.",
      verified: true,
    },
    {
      id: `${salonName}-r3`,
      authorName: "Sara Khan",
      reviewType: "Hospitality",
      rating: 5,
      date: "28 Jul 2026",
      serviceName,
      staffMember: { name: staffName, role: "Specialist" },
      comment: "Felt taken care of from check-in to finish. Highly recommend.",
      verified: true,
    },
  ]
}

/** Hero / gallery slides: unique cover + gallery, capped at 5. */
export function getSalonHeroSlides(salon: Salon, max = 5): string[] {
  const urls = [salon.coverImageUrl, salon.imageUrl, ...salon.gallery]
  const unique: string[] = []
  for (const url of urls) {
    if (url && !unique.includes(url)) unique.push(url)
    if (unique.length >= max) break
  }
  return unique
}

const CARD_GALLERY_LIMIT = 3

/**
 * Listing card slider: explore/list photo first, then up to 3 gallery photos.
 * Cover is never included (matches Glammzo-web getSalonCardImages).
 */
export function getSalonCardImages(
  salon: Pick<Salon, "imageUrl" | "coverImageUrl" | "gallery">,
): string[] {
  const exploreUrl = salon.imageUrl?.trim() || ""
  const coverUrl = salon.coverImageUrl?.trim() || ""
  const urls: string[] = []

  if (exploreUrl) urls.push(exploreUrl)

  for (const url of salon.gallery ?? []) {
    if (urls.length >= 1 + CARD_GALLERY_LIMIT) break
    const trimmed = url?.trim()
    if (!trimmed) continue
    if (coverUrl && trimmed === coverUrl) continue
    if (urls.includes(trimmed)) continue
    urls.push(trimmed)
  }

  if (urls.length > 0) return urls
  return exploreUrl ? [exploreUrl] : coverUrl ? [coverUrl] : []
}

export function flattenAmenities(amenities?: SalonAmenities) {
  if (!amenities?.categories?.length) return []
  const rows: { id: string; label: string; icon: string }[] = []
  for (const category of amenities.categories) {
    if (category.visible === false) continue
    const items = category.items?.filter(Boolean) ?? []
    if (items.length > 0) {
      for (const item of items) {
        rows.push({ id: `${category.name}-${item}`, label: item, icon: category.icon })
      }
    } else if (category.name.trim()) {
      rows.push({ id: category.name, label: category.name, icon: category.icon })
    }
  }
  return rows
}

export const mockSalons: Salon[] = [
  {
    id: "salon-luxe-cut",
    name: "Luxe Cut Studio",
    area: "Bandra West",
    city: "Mumbai",
    imageUrl: img.luxe,
    coverImageUrl: img.luxeCover,
    rating: 4.8,
    reviews: 214,
    distanceKm: 1.2,
    isFeatured: true,
    businessType: "Salon",
    isOpenNow: true,
    priceFrom: 499,
    shortDescription: "Precision cuts, color, and blowouts in a calm studio.",
    description:
      "A quiet Bandra studio for tailored cuts and considered color. Book online, pay at the salon.",
    address: "14 Hill Road, Bandra West, Mumbai",
    phone: "+91 98765 43210",
    hours: "10:00 AM – 8:00 PM",
    offers: [
      {
        id: "off-luxe-10",
        code: "FIRST10",
        title: "10% off first visit",
        discountType: "percent",
        discountValue: 10,
        isActive: true,
      },
    ],
    packages: [
      {
        id: "pkg-luxe-glow",
        name: "Cut + Blowout",
        shortDescription: "Signature cut finished with a polished blowout.",
        imageUrl: img.luxeCover,
        packagePrice: 1299,
        comparePrice: 1498,
        totalDurationMin: 85,
        badge: "Popular",
        isFeatured: true,
        items: [
          { serviceId: "svc-haircut", serviceName: "Signature Haircut", quantity: 1 },
          { serviceId: "svc-blowout", serviceName: "Blowout & Style", quantity: 1 },
        ],
      },
    ],
    services: [
      {
        id: "svc-haircut",
        name: "Signature Haircut",
        durationMin: 45,
        price: 799,
        category: "Hair",
        imageUrl: img.luxe,
        description: "Consultation, wash, cut, and finish.",
        includes: ["Consultation", "Wash", "Cut", "Finish"],
      },
      {
        id: "svc-blowout",
        name: "Blowout & Style",
        durationMin: 40,
        price: 699,
        category: "Hair",
        imageUrl: img.luxeCover,
        includes: ["Wash", "Blow dry", "Style"],
      },
      {
        id: "svc-color",
        name: "Root Touch-up",
        durationMin: 75,
        price: 1899,
        compareAtPrice: 2199,
        category: "Color",
        imageUrl: img.luxe,
        includes: ["Color application", "Tone", "Finish"],
      },
    ],
    gallery: [img.luxe, img.luxe2, img.luxe3, img.luxe4, img.luxeCover],
    amenities: defaultAmenities,
    customerReviews: reviewsFor("Luxe Cut Studio", "Aisha Khan", "Signature Haircut"),
    team: [
      { id: "st-1", name: "Aisha Khan", role: "Senior stylist" },
      { id: "st-2", name: "Rohan Mehta", role: "Colorist" },
    ],
  },
  {
    id: "salon-glow-house",
    name: "Glow House",
    area: "Koramangala",
    city: "Bengaluru",
    imageUrl: img.glow,
    coverImageUrl: img.glowCover,
    rating: 4.6,
    reviews: 162,
    distanceKm: 2.8,
    isFeatured: true,
    businessType: "Beauty Parlour",
    isOpenNow: true,
    priceFrom: 399,
    shortDescription: "Skin-first facials and clean beauty rituals.",
    description: "Calm treatment rooms focused on hydration facials and brow care.",
    address: "88 5th Block, Koramangala, Bengaluru",
    phone: "+91 91234 56780",
    hours: "11:00 AM – 9:00 PM",
    offers: [],
    packages: [],
    services: [
      {
        id: "svc-classic-facial",
        name: "Classic Facial",
        durationMin: 60,
        price: 1299,
        category: "Skin",
        imageUrl: img.glow,
        includes: ["Cleanse", "Extract", "Mask", "Moisturize"],
      },
      {
        id: "svc-cleanup",
        name: "Express Cleanup",
        durationMin: 30,
        price: 699,
        category: "Skin",
        imageUrl: img.glowCover,
        includes: ["Cleanse", "Steam", "Extract"],
      },
      {
        id: "svc-brows",
        name: "Brow Shape",
        durationMin: 20,
        price: 399,
        category: "Brows",
        imageUrl: img.glow,
        includes: ["Map", "Shape", "Tint optional"],
      },
    ],
    gallery: [img.glow, img.glow2, img.glow3, img.glow4, img.glowCover],
    amenities: defaultAmenities,
    customerReviews: reviewsFor("Glow House", "Neha Rao", "Classic Facial"),
    team: [{ id: "st-3", name: "Neha Rao", role: "Skin therapist" }],
  },
  {
    id: "salon-nail-atelier",
    name: "Nail Atelier",
    area: "Jubilee Hills",
    city: "Hyderabad",
    imageUrl: img.nail,
    coverImageUrl: img.nailCover,
    rating: 4.9,
    reviews: 98,
    distanceKm: 4.1,
    businessType: "Nail Art Studio",
    isOpenNow: false,
    priceFrom: 599,
    shortDescription: "Gel, art, and spa manicures with quiet booths.",
    description: "Private nail booths for gel systems and spa pedicures.",
    address: "22 Road No. 36, Jubilee Hills, Hyderabad",
    phone: "+91 99887 66554",
    hours: "12:00 PM – 8:30 PM",
    offers: [
      {
        id: "off-nail-flat",
        code: "GEL200",
        title: "₹200 off gel sets",
        discountType: "fixed",
        discountValue: 200,
        isActive: true,
      },
    ],
    packages: [],
    services: [
      {
        id: "svc-gel-mani",
        name: "Gel Manicure",
        durationMin: 50,
        price: 999,
        category: "Nails",
        imageUrl: img.nail,
        includes: ["Prep", "Gel color", "Cuticle care"],
      },
      {
        id: "svc-spa-pedi",
        name: "Spa Pedicure",
        durationMin: 55,
        price: 1199,
        category: "Nails",
        imageUrl: img.nailCover,
        includes: ["Soak", "Scrub", "Polish"],
      },
    ],
    gallery: [img.nail, img.nail2, img.nail3, img.nail4, img.nailCover],
    amenities: defaultAmenities,
    customerReviews: reviewsFor("Nail Atelier", "Priya Shah", "Gel Manicure"),
    team: [{ id: "st-4", name: "Priya Shah", role: "Nail artist" }],
  },
  {
    id: "salon-urban-fade",
    name: "Urban Fade",
    area: "Andheri West",
    city: "Mumbai",
    imageUrl: img.luxeCover,
    coverImageUrl: img.luxe,
    rating: 4.7,
    reviews: 128,
    distanceKm: 3.4,
    businessType: "Barber Shop",
    isOpenNow: true,
    priceFrom: 299,
    shortDescription: "Fades, beard work, and quick chair turns.",
    description: "Neighborhood barber with transparent menus and easy booking.",
    address: "41 Lokhandwala, Andheri West, Mumbai",
    phone: "+91 90000 11122",
    hours: "10:00 AM – 9:00 PM",
    offers: [],
    packages: [],
    services: [
      {
        id: "svc-fade",
        name: "Skin Fade",
        durationMin: 35,
        price: 499,
        category: "Hair",
        imageUrl: img.luxeCover,
        includes: ["Consultation", "Cut", "Finish"],
      },
    ],
    gallery: [img.luxeCover, img.luxe2, img.luxe3, img.luxe4, img.luxe],
    amenities: defaultAmenities,
    customerReviews: reviewsFor("Urban Fade", "Arjun Desai", "Skin Fade"),
    team: [{ id: "st-5", name: "Arjun Desai", role: "Barber" }],
  },
  {
    id: "salon-still-waters",
    name: "Still Waters Spa",
    area: "Indiranagar",
    city: "Bengaluru",
    imageUrl: img.glowCover,
    coverImageUrl: img.glow,
    rating: 4.8,
    reviews: 86,
    distanceKm: 5.1,
    isFeatured: true,
    businessType: "Spa",
    isOpenNow: true,
    priceFrom: 1499,
    shortDescription: "Massage and recovery rituals in a quiet studio.",
    description: "Calm spa rooms for massage and body rituals.",
    address: "12 100 Feet Road, Indiranagar, Bengaluru",
    phone: "+91 98888 77665",
    hours: "11:00 AM – 8:00 PM",
    offers: [],
    packages: [],
    services: [
      {
        id: "svc-swedish",
        name: "Swedish Massage",
        durationMin: 60,
        price: 2499,
        category: "Spa",
        imageUrl: img.glowCover,
        includes: ["Consultation", "Massage", "Herbal tea"],
      },
    ],
    gallery: [img.glowCover, img.glow2, img.glow3, img.glow4, img.glow],
    amenities: defaultAmenities,
    customerReviews: reviewsFor("Still Waters Spa", "Meera Iyer", "Swedish Massage"),
    team: [{ id: "st-6", name: "Meera Iyer", role: "Therapist" }],
  },
  {
    id: "salon-both-sides",
    name: "Both Sides Studio",
    area: "Powai",
    city: "Mumbai",
    imageUrl: img.luxe,
    coverImageUrl: img.nailCover,
    rating: 4.5,
    reviews: 74,
    distanceKm: 6.2,
    businessType: "Unisex Salon",
    isOpenNow: true,
    priceFrom: 449,
    shortDescription: "Unisex cuts and grooming under one roof.",
    description: "A unisex salon for everyday cuts and styling.",
    address: "Hiranandani Gardens, Powai, Mumbai",
    phone: "+91 97777 66554",
    hours: "10:30 AM – 8:30 PM",
    offers: [],
    packages: [],
    services: [
      {
        id: "svc-unisex-cut",
        name: "Unisex Haircut",
        durationMin: 40,
        price: 699,
        category: "Hair",
        imageUrl: img.luxe,
        includes: ["Wash", "Cut", "Style"],
      },
    ],
    gallery: [img.luxe, img.nail2, img.luxe3, img.nail4, img.nailCover],
    amenities: defaultAmenities,
    customerReviews: reviewsFor("Both Sides Studio", "Kabir Shah", "Unisex Haircut"),
    team: [{ id: "st-7", name: "Kabir Shah", role: "Stylist" }],
  },
]

export function getSalonById(id: string): Salon | undefined {
  return mockSalons.find((salon) => salon.id === id)
}

export const mockLocationLabel = "Koramangala, Bengaluru"

