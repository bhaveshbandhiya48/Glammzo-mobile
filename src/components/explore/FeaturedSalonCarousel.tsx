import { SalonCarousel } from "@/components/explore/SalonCarousel"
import type { Salon } from "@/data/types"

type Props = {
  salons: Salon[]
}

/** @deprecated Prefer SalonCarousel with an explicit title. */
export function FeaturedSalonCarousel({ salons }: Props) {
  return <SalonCarousel title="Featured" salons={salons} />
}
