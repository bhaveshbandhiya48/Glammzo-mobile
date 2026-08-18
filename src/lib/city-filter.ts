import type { Salon } from "@/data/types"

const CITY_ALIASES: Record<string, string> = {
  bangalore: "bengaluru",
  bengaluru: "bengaluru",
}

export function normalizeCityName(value: string | null | undefined): string {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

  return CITY_ALIASES[normalized] ?? normalized
}

export function isSalonInCity(salon: Salon, city: string): boolean {
  const selectedCity = normalizeCityName(city)
  const salonCity = normalizeCityName(salon.city)
  return Boolean(selectedCity && salonCity && selectedCity === salonCity)
}

export function filterSalonsByCity(salons: Salon[], city: string): Salon[] {
  return salons.filter((salon) => isSalonInCity(salon, city))
}
