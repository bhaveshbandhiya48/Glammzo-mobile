export type SalonService = {
  id: string
  name: string
  durationMin: number
  price: number
  compareAtPrice?: number
  category: string
  imageUrl: string
  description?: string
  includes: string[]
}

export type SalonPackage = {
  id: string
  name: string
  shortDescription: string
  imageUrl: string
  packagePrice: number
  comparePrice: number
  totalDurationMin: number
  items: { serviceId: string; serviceName: string; quantity: number }[]
  badge?: string | null
  isFeatured?: boolean
  showComparePrice?: boolean
}

export type SalonOffer = {
  id: string
  code: string
  title: string
  description?: string | null
  discountType: "percent" | "fixed"
  discountValue: number
  appliesTo?: "all_services" | "selected_services"
  serviceIds?: string[]
  startsAt?: string | null
  endsAt?: string | null
  isActive: boolean
  minOrderRupees?: number | null
  customerEligibility?: "all_customers" | "new_customers_only"
  terms?: string | null
  ctaLabel?: string
}

export type SalonAmenityCategory = {
  icon: string
  name: string
  visible?: boolean
  items?: string[]
}

export type SalonAmenities = {
  categories: SalonAmenityCategory[]
}

export type SalonTaxInfo = {
  enabled: boolean
  ratePercent: number
  gstNumber: string
}

export type SalonReview = {
  id: string
  authorName: string
  reviewType: string
  rating: number
  date: string
  serviceName: string
  staffMember: { name: string; role: string }
  comment: string
  verified?: boolean
  ownerReply?: string | null
  ownerReplyDate?: string | null
}

export type Salon = {
  id: string
  name: string
  area: string
  city: string
  imageUrl: string
  coverImageUrl: string
  rating: number
  reviews: number
  distanceKm: number
  latitude?: number
  longitude?: number
  isFeatured?: boolean
  businessType?: string
  isOpenNow: boolean
  priceFrom: number
  shortDescription: string
  description: string
  address: string
  phone: string
  whatsappPhone?: string
  hours: string
  services: SalonService[]
  packages: SalonPackage[]
  offers: SalonOffer[]
  gallery: string[]
  amenities?: SalonAmenities
  customerReviews?: SalonReview[]
  team: { id: string; name: string; role: string; bio?: string; imageUrl?: string }[]
  /** Present when salon GST is enabled with a GSTIN. */
  tax?: SalonTaxInfo | null
}

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "upcoming"
  | "completed"
  | "cancelled"
  | "declined"
  | "expired"

export type Booking = {
  id: string
  salonId: string
  salonName: string
  salonArea: string
  services: { id: string; name: string; price: number; durationMin: number }[]
  date: string
  time: string
  price: number
  durationMin: number
  notes?: string
  status: BookingStatus
  createdAt: string
  /** Hours before start the customer must cancel; salon policy or platform default. */
  startsAt?: string
  cancelNoticeHours?: number
  staffName?: string
  declineReason?: string
  hasVerifiedReview?: boolean
  confirmationDeadline?: string
}

